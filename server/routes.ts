import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLayerSchema, insertFeatureSchema, insertBasemapSchema, insertAppSettingSchema, auditLogs } from "@shared/schema";
import type { InsertAdminBoundary } from "@shared/schema";
import { z } from "zod";
import { pool } from "./db";
import { db } from "./db";
import multer from "multer";
import proj4 from "proj4";
import * as fs from "fs";
import * as https from "https";
import * as shapefile from "shapefile";
import passport from "passport";
import { hashPassword, requireAuth, requireAdmin } from "./auth";

const upload = multer({ dest: "/tmp/uploads/", limits: { fileSize: 1024 * 1024 * 1024 } }); // 1GB

const NCP_CLIENT_ID = process.env.NCP_CLIENT_ID || "";
const NCP_CLIENT_SECRET = process.env.NCP_CLIENT_SECRET || "";
const GRID_CELL_SIZE = 0.0027; // ≈300m 격자 단위

// ── 비동기 에러 래퍼 — try-catch 없는 라우트도 안전하게 처리 ──
type AsyncHandler = (req: Request, res: Response) => Promise<any>;
const asyncHandler = (fn: AsyncHandler) => (req: Request, res: Response, next: Function) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error(`[${req.method} ${req.path}] Unhandled error:`, err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
};

// ── 감사 로그 헬퍼 (GS 인증 1-4) ───────────────────────────────────────
function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

async function writeAuditLog(req: Request, action: string, resource?: string, resourceId?: string, details?: any) {
  try {
    const user = req.user as any;
    await db.insert(auditLogs).values({
      userId: user?.id || null,
      username: user?.username || null,
      action,
      resource: resource || null,
      resourceId: resourceId || null,
      ip: getClientIp(req),
      userAgent: req.headers["user-agent"] || null,
      details: details || null,
    });
  } catch (e) {
    console.error("Audit log write failed:", e);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ══════════════════════════════════════════════════════════════════════
  // 인증 API (GS 인증 1-1, 1-2, 1-6)
  // ══════════════════════════════════════════════════════════════════════

  /** 회원가입 */
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "아이디와 비밀번호를 입력해주세요." });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "비밀번호는 8자 이상이어야 합니다." });
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ message: "이미 사용 중인 아이디입니다." });
      }

      const hashed = await hashPassword(password);
      const user = await storage.createUser({ username, password: hashed });

      // 첫 번째 사용자는 자동으로 admin 승격
      const userCount = await storage.getUserCount();
      if (userCount <= 1) {
        await storage.promoteToAdmin(user.id);
        user.role = "admin";
      }

      // 자동 로그인
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "로그인 처리 중 오류가 발생했습니다." });
        writeAuditLog(req, "REGISTER", "user", user.id);
        const { password: _, ...safeUser } = user;
        return res.status(201).json(safeUser);
      });
    } catch (e: any) {
      return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
  });

  /** 로그인 */
  app.post("/api/auth/login", (req: Request, res: Response, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return res.status(500).json({ message: "서버 오류가 발생했습니다." });
      if (!user) {
        // GS 인증 1-1: 단일화된 오류 메시지
        writeAuditLog(req, "LOGIN_FAILED", "user", undefined, { username: req.body.username });
        return res.status(401).json({ message: info?.message || "아이디 또는 비밀번호가 올바르지 않습니다." });
      }
      req.login(user, (loginErr) => {
        if (loginErr) return res.status(500).json({ message: "로그인 처리 중 오류가 발생했습니다." });
        writeAuditLog(req, "LOGIN", "user", user.id);
        const { password: _, ...safeUser } = user;
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  /** 로그아웃 (GS 인증 1-6: 세션 완전 파기) */
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    writeAuditLog(req, "LOGOUT", "user", (req.user as any)?.id);
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "로그아웃 처리 중 오류가 발생했습니다." });
      req.session.destroy((sessionErr) => {
        if (sessionErr) console.error("Session destroy error:", sessionErr);
        res.clearCookie("connect.sid");
        return res.json({ message: "로그아웃되었습니다." });
      });
    });
  });

  /** Google 로그인 (Firebase ID 토큰 검증) */
  app.post("/api/auth/google", async (req: Request, res: Response) => {
    try {
      const { idToken } = req.body;
      if (!idToken) return res.status(400).json({ message: "토큰이 없습니다." });

      // Firebase REST API로 토큰 검증
      const firebaseRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        }
      );
      const firebaseData = await firebaseRes.json();
      if (!firebaseRes.ok || !firebaseData.users?.[0]) {
        return res.status(401).json({ message: "유효하지 않은 Google 토큰입니다." });
      }

      const googleUser = firebaseData.users[0];
      const email = googleUser.email;
      if (!email) return res.status(400).json({ message: "이메일 정보가 없습니다." });

      // 기존 유저 조회 또는 신규 생성
      let user = await storage.getUserByUsername(email);
      if (!user) {
        const userCount = await storage.getUserCount();
        user = await storage.createUser({ username: email, password: "!oauth-no-local-login!" });
        if (userCount === 0) {
          await storage.promoteToAdmin(user.id);
          user.role = "admin";
        }
      }

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "세션 생성 실패" });
        writeAuditLog(req, "LOGIN_GOOGLE", "user", user!.id);
        const { password: _, ...safeUser } = user as any;
        return res.json(safeUser);
      });
    } catch (e: any) {
      return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
  });

  /** 현재 사용자 조회 */
  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ message: "로그인이 필요합니다." });
    }
    const { password: _, ...safeUser } = req.user as any;
    return res.json(safeUser);
  });

  /** 감사 로그 조회 (admin only) */
  // TODO: requireAdmin으로 전환 예정 (현재 테스트 중이라 requireAuth 유지)
  app.get("/api/admin/audit-logs", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const data = await storage.getAuditLogs(limit, offset);
    res.json(data);
  }));

  // ══════════════════════════════════════════════════════════════════════
  // Layer CRUD (GS 인증 1-3: 권한별 접근 통제)
  app.get("/api/layers", requireAuth, asyncHandler(async (_req, res) => {
    const layers = await storage.getLayers();
    res.json(layers);
  }));

  app.get("/api/layers/:id", requireAuth, asyncHandler(async (req, res) => {
    const layer = await storage.getLayer(req.params.id);
    if (!layer) return res.status(404).json({ message: "Layer not found" });
    res.json(layer);
  }));

  app.post("/api/layers", requireAuth, async (req, res) => {
    try {
      const data = insertLayerSchema.parse(req.body);
      const layer = await storage.createLayer(data);
      writeAuditLog(req, "CREATE", "layer", layer.id, { name: layer.name });
      res.status(201).json(layer);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  const layerUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    category: z.string().transform(v => v.trim() || "일반").optional(),
    subCategory: z.string().nullable().optional(),
    visible: z.boolean().optional(),
    opacity: z.number().min(0).max(1).optional(),
    strokeColor: z.string().optional(),
    fillColor: z.string().optional(),
    strokeWidth: z.number().min(0.5).max(10).optional(),
    pointRadius: z.number().min(1).max(20).optional(),
    renderMode: z.enum(["auto", "feature", "tile", "aggregate"]).optional(),
    featureLimit: z.number().int().min(100).max(50000).optional(),
    minZoomForFeatures: z.number().int().min(0).max(22).optional(),
    minZoomForClusters: z.number().int().min(0).max(22).optional(),
    tileEnabled: z.boolean().optional(),
    tileMaxZoom: z.number().int().min(0).max(22).optional(),
    sortOrder: z.number().int().min(0).optional(),
  }).strict();

  // 드래그 순서 일괄 저장
  app.patch("/api/layers/reorder", requireAuth, asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.some(id => typeof id !== "string")) {
      return res.status(400).json({ message: "ids must be a string array" });
    }
    await Promise.all(ids.map((id: string, idx: number) => storage.updateLayer(id, { sortOrder: idx })));
    res.json({ success: true });
  }));

  app.patch("/api/layers/:id", requireAuth, asyncHandler(async (req, res) => {
    const parsed = layerUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "잘못된 요청 데이터", errors: parsed.error.flatten() });
    }
    const layer = await storage.updateLayer(req.params.id, parsed.data);
    if (!layer) return res.status(404).json({ message: "Layer not found" });
    writeAuditLog(req, "UPDATE", "layer", layer.id, parsed.data);
    res.json(layer);
  }));

  app.delete("/api/layers/:id", requireAuth, asyncHandler(async (req, res) => {
    const ok = await storage.deleteLayer(req.params.id);
    if (!ok) return res.status(404).json({ message: "Layer not found" });
    writeAuditLog(req, "DELETE", "layer", req.params.id);
    res.json({ success: true });
  }));

  // ── MVT 벡터 타일 ──────────────────────────────────────────────────
  app.get("/api/layers/:id/tiles/:z/:x/:y.pbf", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const z = parseInt(req.params.z, 10);
      const x = parseInt(req.params.x, 10);
      const y = parseInt(req.params.y, 10);

      if (isNaN(z) || isNaN(x) || isNaN(y) || z < 0 || z > 22) {
        return res.status(400).send("Invalid tile coordinates");
      }

      const layer = await storage.getLayer(id);
      if (!layer) return res.status(404).send("Layer not found");

      const tile = await storage.getMvtTile(id, z, x, y);

      res.setHeader("Content-Type", "application/vnd.mapbox-vector-tile");
      res.setHeader("Cache-Control", "public, max-age=3600");

      if (!tile || tile.length === 0) {
        return res.status(204).send();
      }

      res.send(tile);
    } catch (err) {
      console.error("MVT tile error:", err);
      res.status(500).send("Tile generation failed");
    }
  });

  // Feature API with BBOX filtering
  app.get("/api/layers/:id/features", requireAuth, async (req, res) => {
    const { bbox, limit, zoom } = req.query;
    const layer = await storage.getLayer(req.params.id);
    if (!layer) return res.status(404).json({ message: "Layer not found" });

    let parsedBbox: number[] | undefined;
    if (bbox && typeof bbox === "string") {
      parsedBbox = bbox.split(",").map(Number);
      if (parsedBbox.length !== 4 || parsedBbox.some(isNaN)) {
        return res.status(400).json({ message: "Invalid bbox format. Use: minLng,minLat,maxLng,maxLat" });
      }
    }

    const parsedLimit = limit ? Math.min(parseInt(limit as string, 10), layer.featureLimit) : layer.featureLimit;
    const features = await storage.getFeaturesByLayer(req.params.id, parsedBbox, parsedLimit);

    res.json({
      type: "FeatureCollection",
      features: features.map(f => ({
        type: "Feature",
        id: f.id,
        geometry: f.geometry,
        properties: { ...f.properties as object, _id: f.id, _layerId: f.layerId },
      })),
      totalCount: layer.featureCount,
      returned: features.length,
      limited: features.length >= parsedLimit,
    });
  });

  app.post("/api/layers/:id/features", requireAuth, async (req, res) => {
    try {
      const layer = await storage.getLayer(req.params.id);
      if (!layer) return res.status(404).json({ message: "Layer not found" });

      if (Array.isArray(req.body)) {
        const featureList = req.body.map((f: any) => ({
          layerId: req.params.id,
          geometry: f.geometry || f,
          properties: f.properties || {},
        }));
        const created = await storage.createFeatures(featureList);

        // 배치 추가 후 격자 캐시 자동 리빌드 (백그라운드)
        const CELL_SIZE = GRID_CELL_SIZE;
        storage.buildGridCache(req.params.id, CELL_SIZE)
          .then(cnt => console.log(`[auto] Grid cache rebuilt for layer ${req.params.id}: ${cnt} cells`))
          .catch(err => console.error(`[auto] Grid cache rebuild failed:`, err?.message || err));

        res.status(201).json({ created: created.length });
      } else {
        const feature = await storage.createFeature({
          layerId: req.params.id,
          geometry: req.body.geometry || req.body,
          properties: req.body.properties || {},
        });
        res.status(201).json(feature);
      }
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/layers/:id/features", requireAuth, async (req, res) => {
    const count = await storage.deleteFeaturesByLayer(req.params.id);

    // 피처 삭제 시 격자 캐시도 제거 (백그라운드)
    const CELL_SIZE = GRID_CELL_SIZE;
    storage.buildGridCache(req.params.id, CELL_SIZE)
      .then(cnt => console.log(`[auto] Grid cache rebuilt after delete for layer ${req.params.id}: ${cnt} cells`))
      .catch(err => console.error(`[auto] Grid cache rebuild failed:`, err?.message || err));

    res.json({ deleted: count });
  });

  app.get("/api/layers/:id/features-in-bbox", requireAuth, async (req, res) => {
    const { bbox, limit: limitStr } = req.query;
    if (!bbox || typeof bbox !== "string") {
      return res.status(400).json({ message: "bbox required" });
    }
    const parsedBbox = (bbox as string).split(",").map(Number);
    if (parsedBbox.length !== 4) return res.status(400).json({ message: "Invalid bbox" });
    const limit = limitStr ? Math.min(parseInt(limitStr as string, 10), 5000) : 1000;
    const data = await storage.getFeaturesInBbox(req.params.id, parsedBbox, limit);
    res.json(data);
  });

  // Grid aggregation for low zoom
  app.get("/api/layers/:id/aggregate", requireAuth, async (req, res) => {
    const { bbox, gridSize } = req.query;
    if (!bbox || typeof bbox !== "string") {
      return res.status(400).json({ message: "bbox required" });
    }
    const parsedBbox = (bbox as string).split(",").map(Number);
    if (parsedBbox.length !== 4) return res.status(400).json({ message: "Invalid bbox" });

    const CELL_SIZE = GRID_CELL_SIZE; // ≈300m 고정
    try {
      // 캐시 우선 조회
      const cached = await storage.getGridCache(req.params.id, CELL_SIZE, parsedBbox);
      if (cached.length > 0) return res.json(cached);

      // 캐시 없으면 실시간 집계 (fallback)
      const [minLng, minLat, maxLng, maxLat] = parsedBbox;
      const size = Math.max(1, parseInt(gridSize as string, 10) || 10);
      const lngStep = (maxLng - minLng) / size;
      const latStep = (maxLat - minLat) / size;
      const result = await pool.query(
        `SELECT AVG(lng)::float8 AS lng, AVG(lat)::float8 AS lat, count(*)::int AS count
         FROM (
           SELECT lng, lat,
             floor((lng - $1) / $3)::int AS gx,
             floor((lat - $2) / $4)::int AS gy
           FROM features
           WHERE layer_id = $5
             AND lng IS NOT NULL AND lat IS NOT NULL
             AND lng BETWEEN $1 AND $6
             AND lat BETWEEN $2 AND $7
         ) t
         GROUP BY gx, gy
         HAVING count(*) > 0
         ORDER BY count DESC
         LIMIT 500`,
        [minLng, minLat, lngStep, latStep, req.params.id, maxLng, maxLat]
      );
      res.json(result.rows.map((r: any) => ({
        lng: parseFloat(r.lng),
        lat: parseFloat(r.lat),
        count: parseInt(r.count),
      })));
    } catch (err: any) {
      console.error("[aggregate] error:", err?.message || err);
      res.status(500).json({ message: "aggregate failed" });
    }
  });

  app.get("/api/layers/:id/boundary-aggregate", requireAuth, async (req, res) => {
    const { bbox, level } = req.query;
    if (!bbox || typeof bbox !== "string" || !level) {
      return res.status(400).json({ message: "bbox and level required" });
    }
    const parsedBbox = (bbox as string).split(",").map(Number);
    if (parsedBbox.length !== 4) return res.status(400).json({ message: "Invalid bbox" });
    const data = await storage.getBoundaryAggregation(req.params.id, level as string, parsedBbox);
    res.json(data);
  });

  // Spatial query: radius search
  app.get("/api/spatial/radius", requireAuth, async (req, res) => {
    const { lng, lat, radius, layerIds } = req.query;
    if (!lng || !lat || !radius) {
      return res.status(400).json({ message: "lng, lat, radius required" });
    }
    const parsedLayerIds = layerIds ? (layerIds as string).split(",") : undefined;
    const features = await storage.getFeaturesInRadius(
      parseFloat(lng as string),
      parseFloat(lat as string),
      parseFloat(radius as string),
      parsedLayerIds,
    );

    await storage.createSpatialQuery({
      name: `Radius search at [${lng}, ${lat}]`,
      queryType: "radius",
      parameters: { lng, lat, radius, layerIds: parsedLayerIds },
    });

    res.json({
      type: "FeatureCollection",
      features: features.map(f => ({
        type: "Feature",
        id: f.id,
        geometry: f.geometry,
        properties: { ...f.properties as object, _id: f.id, _layerId: f.layerId },
      })),
      count: features.length,
    });
  });

  // Spatial query history
  app.get("/api/spatial/history", requireAuth, async (_req, res) => {
    const queries = await storage.getSpatialQueries();
    res.json(queries);
  });

  // Basemap CRUD
  app.get("/api/proxy/naver-tiles/:z/:x/:y", async (_req, res) => {
    res.status(503).json({ message: "네이버 지도는 JavaScript SDK 인증이 필요합니다. NCP 콘솔에서 Web 서비스 URL 설정을 확인하세요." });
  });

  // VWorld WMS 프록시 (CORS 및 API 키 보호)
  app.get("/api/proxy/wms", (req, res) => {
    const params = new URLSearchParams(req.query as Record<string, string>);
    params.set("KEY", process.env.VWORLD_KEY || process.env.VITE_VWORLD_KEY || "");
    params.set("DOMAIN", process.env.VWORLD_DOMAIN || req.hostname);
    const path = `/req/wms?${params.toString()}`;
    const options: https.RequestOptions = {
      hostname: "api.vworld.kr",
      port: 443,
      path,
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BIGSPACE/1.0)",
        "Accept": "image/png,image/*",
      },
      // rejectUnauthorized: true (default)
    };
    const proxyReq = https.request(options, (proxyRes) => {
      res.setHeader("Content-Type", proxyRes.headers["content-type"] || "image/png");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.status(proxyRes.statusCode || 200);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", (e) => {
      console.error("WMS 프록시 오류:", e.message);
      res.status(500).send("WMS proxy error");
    });
    proxyReq.end();
  });

  // VWorld WFS 프록시 (CORS 및 API 키 보호)
  app.get("/api/proxy/wfs", (req, res) => {
    const params = new URLSearchParams(req.query as Record<string, string>);
    params.set("KEY", process.env.VWORLD_KEY || process.env.VITE_VWORLD_KEY || "");
    params.set("DOMAIN", process.env.VWORLD_DOMAIN || req.hostname);
    const path = `/req/wfs?${params.toString()}`;
    const options: https.RequestOptions = {
      hostname: "api.vworld.kr",
      port: 443,
      path,
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BIGSPACE/1.0)",
        "Accept": "application/json",
      },
      // rejectUnauthorized: true (default)
    };
    const proxyReq = https.request(options, (proxyRes) => {
      res.setHeader("Content-Type", proxyRes.headers["content-type"] || "application/json");
      res.status(proxyRes.statusCode || 200);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", (e) => {
      console.error("WFS 프록시 오류:", e.message);
      res.status(500).send("WFS proxy error");
    });
    proxyReq.end();
  });

  let kakaoSdkCache: { data: string; fetchedAt: number } | null = null;
  app.get("/api/proxy/kakao-sdk", async (_req, res) => {
    try {
      if (kakaoSdkCache && Date.now() - kakaoSdkCache.fetchedAt < 24 * 60 * 60 * 1000) {
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.send(kakaoSdkCache.data);
      }

      const [loaderResp, mainResp] = await Promise.all([
        fetch("https://spi.maps.daum.net/imap/map_js_init/v3.int.js"),
        fetch("https://t1.daumcdn.net/mapjsapi/internal/4.4.21/v3.js"),
      ]);
      if (!loaderResp.ok || !mainResp.ok) {
        return res.status(502).json({ message: "카카오 SDK 로드 실패" });
      }
      const loaderCode = await loaderResp.text();
      const mainCode = await mainResp.text();
      const patchedLoader = `(function(){var _ow=document.write;document.write=function(){};try{\n${loaderCode}\n}finally{document.write=_ow;}})();\n`;
      const combined = patchedLoader + mainCode;
      kakaoSdkCache = { data: combined, fetchedAt: Date.now() };
      res.setHeader("Content-Type", "text/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(combined);
    } catch (e) {
      res.status(502).json({ message: "카카오 SDK 프록시 오류" });
    }
  });

  app.get("/api/basemaps", requireAuth, async (_req, res) => {
    const list = await storage.getBasemaps();
    res.json(list);
  });

  app.post("/api/basemaps", requireAuth, async (req, res) => {
    try {
      const data = insertBasemapSchema.parse(req.body);
      const basemap = await storage.createBasemap(data);
      res.status(201).json(basemap);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/basemaps/:id", requireAuth, async (req, res) => {
    try {
      const allowedFields = insertBasemapSchema.partial().parse(req.body);
      const basemap = await storage.updateBasemap(req.params.id, allowedFields);
      if (!basemap) return res.status(404).json({ message: "Basemap not found" });
      res.json(basemap);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/basemaps/:id", requireAuth, async (req, res) => {
    const ok = await storage.deleteBasemap(req.params.id);
    if (!ok) return res.status(404).json({ message: "Basemap not found" });
    res.json({ success: true });
  });

  app.post("/api/basemaps/:id/default", requireAuth, async (req, res) => {
    await storage.setDefaultBasemap(req.params.id);
    res.json({ success: true });
  });

  // App settings
  app.get("/api/settings", requireAuth, async (req, res) => {
    const category = req.query.category as string | undefined;
    const settings = await storage.getSettings(category);
    res.json(settings);
  });

  app.get("/api/settings/:key", requireAuth, async (req, res) => {
    const setting = await storage.getSetting(req.params.key);
    if (!setting) return res.status(404).json({ message: "Setting not found" });
    res.json(setting);
  });

  app.put("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      if (req.body.value === undefined) {
        return res.status(400).json({ message: "value is required" });
      }
      const setting = await storage.upsertSetting({
        key: req.params.key,
        value: req.body.value,
        description: req.body.description,
        category: req.body.category || "general",
      });
      res.json(setting);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Administrative Boundaries
  app.get("/api/admin-boundaries", requireAuth, async (req, res) => {
    const { level } = req.query;
    const boundaries = await storage.getAdminBoundaries(level as string | undefined);
    res.json(boundaries);
  });

  app.get("/api/admin-boundaries/levels", requireAuth, async (_req, res) => {
    const levels = await storage.getAdminBoundaryLevels();
    res.json(levels);
  });

  app.get("/api/admin-boundaries/geojson", requireAuth, async (req, res) => {
    const { level } = req.query;
    if (!level) return res.status(400).json({ message: "level 파라미터가 필요합니다" });
    const boundaries = await storage.getAdminBoundaries(level as string);
    res.json({
      type: "FeatureCollection",
      features: boundaries.map(b => ({
        type: "Feature",
        id: b.id,
        geometry: b.geometry,
        properties: { ...b.properties as object, name: b.name, code: b.code, level: b.level, parentCode: b.parentCode },
      })),
    });
  });

  function flattenAllCoords(geom: any): number[][] {
    if (geom.type === 'Point') return [geom.coordinates];
    if (geom.type === 'MultiPoint' || geom.type === 'LineString') return geom.coordinates;
    if (geom.type === 'MultiLineString' || geom.type === 'Polygon') return geom.coordinates.flat();
    if (geom.type === 'MultiPolygon') return geom.coordinates.flat(2);
    return [];
  }

  proj4.defs('EPSG:5179', '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs');
  proj4.defs('EPSG:5181', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs');
  proj4.defs('EPSG:5186', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs');

  function simplifyRing(ring: number[][], tolerance: number): number[][] {
    if (ring.length <= 4) return ring;
    function perpDist(pt: number[], a: number[], b: number[]): number {
      const dx = b[0]-a[0], dy = b[1]-a[1], len2 = dx*dx+dy*dy;
      if (len2 === 0) return Math.sqrt((pt[0]-a[0])**2+(pt[1]-a[1])**2);
      const t = Math.max(0, Math.min(1, ((pt[0]-a[0])*dx+(pt[1]-a[1])*dy)/len2));
      return Math.sqrt((pt[0]-a[0]-t*dx)**2+(pt[1]-a[1]-t*dy)**2);
    }
    const stack: [number,number][] = [[0, ring.length-1]];
    const keep = new Set<number>([0, ring.length-1]);
    while (stack.length > 0) {
      const [s,e] = stack.pop()!;
      let mx=0, mi=s;
      for (let i=s+1; i<e; i++) { const d=perpDist(ring[i],ring[s],ring[e]); if(d>mx){mx=d;mi=i;} }
      if (mx > tolerance) { keep.add(mi); if(mi-s>1)stack.push([s,mi]); if(e-mi>1)stack.push([mi,e]); }
    }
    return Array.from(keep).sort((a,b)=>a-b).map(i=>ring[i]);
  }

  function simplifyAndReproject(geom: any, fromSrid: string, tolerance: number): any {
    const type = geom.type;
    if (type === 'Point') return { ...geom, coordinates: proj4(fromSrid, 'EPSG:4326', geom.coordinates) };
    if (type === 'MultiPoint' || type === 'LineString') return { ...geom, coordinates: geom.coordinates.map((c: number[]) => proj4(fromSrid, 'EPSG:4326', c)) };
    if (type === 'Polygon' || type === 'MultiLineString') {
      return { ...geom, coordinates: geom.coordinates.map((ring: number[][]) => {
        const s = simplifyRing(ring, tolerance);
        return s.map((c: number[]) => proj4(fromSrid, 'EPSG:4326', c));
      })};
    }
    if (type === 'MultiPolygon') {
      return { ...geom, coordinates: geom.coordinates
        .map((poly: number[][][]) => poly.map((ring: number[][]) => {
          const s = simplifyRing(ring, tolerance);
          return s.map((c: number[]) => proj4(fromSrid, 'EPSG:4326', c));
        }))
        .filter((poly: number[][][]) => poly[0] && poly[0].length >= 4)
      };
    }
    return geom;
  }

  app.post("/api/admin-boundaries/upload", requireAuth, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "파일이 필요합니다" });

      const level = req.body.level;
      const srid = req.body.srid || "EPSG:5179";
      const nameField = req.body.nameField || "SIDO_NM";
      const codeField = req.body.codeField || "SIDO_CD";
      const parentCodeField = req.body.parentCodeField;

      if (!level) return res.status(400).json({ message: "level(시도/시군구/읍면동)이 필요합니다" });

      const filePath = req.file.path;
      const originalName = req.file.originalname || "";
      let featuresList: any[] = [];

      if (originalName.endsWith('.geojson') || originalName.endsWith('.json')) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const geojsonData = JSON.parse(raw);
        const fc = geojsonData.type === 'FeatureCollection' ? geojsonData :
                   Array.isArray(geojsonData) ? geojsonData[0] : geojsonData;
        if (!fc || !fc.features) {
          fs.unlinkSync(filePath);
          return res.status(400).json({ message: "GeoJSON FeatureCollection을 찾을 수 없습니다" });
        }
        featuresList = fc.features;
        fs.unlinkSync(filePath);
      } else if (originalName.endsWith('.zip')) {
        const { execSync } = await import('child_process');
        const tmpDir = `/tmp/shp_extract_${Date.now()}`;
        fs.mkdirSync(tmpDir, { recursive: true });
        execSync(`unzip -o "${filePath}" -d "${tmpDir}"`, { encoding: 'utf-8' });
        fs.unlinkSync(filePath);

        const files = fs.readdirSync(tmpDir);
        const shpFile = files.find(f => f.endsWith('.shp'));
        const dbfFile = files.find(f => f.endsWith('.dbf'));
        if (!shpFile || !dbfFile) {
          execSync(`rm -rf "${tmpDir}"`);
          return res.status(400).json({ message: "ZIP 내에 .shp 및 .dbf 파일이 필요합니다" });
        }

        const cpgFile = files.find(f => f.endsWith('.cpg'));
        let encoding = 'utf-8';
        if (cpgFile) {
          encoding = fs.readFileSync(`${tmpDir}/${cpgFile}`, 'utf-8').trim() || 'utf-8';
        }

        const source = await shapefile.open(`${tmpDir}/${shpFile}`, `${tmpDir}/${dbfFile}`, { encoding });
        while (true) {
          const result = await source.read();
          if (result.done) break;
          featuresList.push(result.value);
        }
        execSync(`rm -rf "${tmpDir}"`);
      } else {
        fs.unlinkSync(filePath);
        return res.status(400).json({ message: "지원 형식: .zip (Shapefile), .geojson, .json" });
      }

      if (featuresList.length === 0) {
        return res.status(400).json({ message: "파일에서 피처를 찾을 수 없습니다" });
      }

      const needsReproject = srid !== 'EPSG:4326';
      const tolerance = srid === 'EPSG:4326' ? 0.0005 : 50;

      const boundaries: InsertAdminBoundary[] = featuresList.map((f: any) => {
        let geometry = f.geometry;
        if (needsReproject) {
          geometry = simplifyAndReproject(geometry, srid, tolerance);
        }

        const flatCoords = flattenAllCoords(geometry);
        const lngs = flatCoords.map((c: number[]) => c[0]);
        const lats = flatCoords.map((c: number[]) => c[1]);

        const name = f.properties?.[nameField] || f.properties?.name || '알 수 없음';
        const code = f.properties?.[codeField] || f.properties?.code || '';
        const parentCode = parentCodeField ? (f.properties?.[parentCodeField] || null) : null;

        return {
          name,
          code: String(code),
          level,
          parentCode: parentCode ? String(parentCode) : null,
          geometry,
          properties: f.properties || {},
          minLng: Math.min(...lngs),
          minLat: Math.min(...lats),
          maxLng: Math.max(...lngs),
          maxLat: Math.max(...lats),
          centerLng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
          centerLat: (Math.min(...lats) + Math.max(...lats)) / 2,
        };
      });

      await storage.deleteAdminBoundariesByLevel(level);
      const created = await storage.createAdminBoundaries(boundaries);

      res.json({ success: true, level, count: created.length });

      // 업로드 완료 후 해당 레벨 경계 집계 캐시 백그라운드 빌드
      setImmediate(async () => {
        try {
          const allLayers = await storage.getLayers();
          for (const layer of allLayers) {
            if (layer.featureCount === 0) continue;
            await pool.query(
              "DELETE FROM boundary_aggregate_cache WHERE layer_id=$1 AND level=$2",
              [layer.id, level]
            );
            const result = await pool.query(`
              SELECT ab.id as boundary_id, ab.name, ab.code, ab.center_lng, ab.center_lat,
                     COALESCE(fc.cnt, 0)::int as count
              FROM administrative_boundaries ab
              LEFT JOIN (
                SELECT ab2.id as bid, count(*)::int as cnt
                FROM features f
                JOIN administrative_boundaries ab2
                  ON ab2.level = $2
                  AND f.lat BETWEEN ab2.min_lat AND ab2.max_lat
                  AND f.lng BETWEEN ab2.min_lng AND ab2.max_lng
                WHERE f.layer_id = $1
                GROUP BY ab2.id
              ) fc ON fc.bid = ab.id
              WHERE ab.level = $2
              ORDER BY count DESC
            `, [layer.id, level]);
            const cacheRows = result.rows as any[];
            const CHUNK = 100;
            for (let i = 0; i < cacheRows.length; i += CHUNK) {
              const chunk = cacheRows.slice(i, i + CHUNK);
              const params: any[] = [];
              const placeholders = chunk.map((r, j) => {
                const base = j * 8;
                params.push(layer.id, level, r.boundary_id, r.name, r.code, r.count, r.center_lng, r.center_lat);
                return `(gen_random_uuid(),$${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8})`;
              });
              if (placeholders.length > 0) {
                await pool.query(
                  `INSERT INTO boundary_aggregate_cache (id,layer_id,level,boundary_id,boundary_name,boundary_code,count,center_lng,center_lat)
                   VALUES ${placeholders.join(",")}`,
                  params
                );
              }
            }
            console.log(`[cache] ${layer.name} × ${level}: ${cacheRows.length}개 캐시 완료`);
          }
        } catch (e) {
          console.error("[cache] 경계 캐시 빌드 오류:", e);
        }
      });
    } catch (e: any) {
      console.error("Admin boundary upload error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin-boundaries/:level", requireAuth, async (req, res) => {
    const count = await storage.deleteAdminBoundariesByLevel(req.params.level);
    res.json({ success: true, deleted: count });
  });

  // Stats endpoint
  app.get("/api/stats", requireAuth, async (_req, res) => {
    const allLayers = await storage.getLayers();
    const totalFeatures = allLayers.reduce((sum, l) => sum + l.featureCount, 0);
    res.json({
      layerCount: allLayers.length,
      totalFeatures,
      layers: allLayers.map(l => ({ id: l.id, name: l.name, featureCount: l.featureCount })),
    });
  });

  // ── 일회성 데이터 마이그레이션 엔드포인트 ───────────────────────────────
  const MIGRATE_TOKEN = process.env.MIGRATE_TOKEN || (() => {
    if (process.env.NODE_ENV === "production") throw new Error("MIGRATE_TOKEN is required in production");
    return "dev-migrate-token";
  })();

  // 피처 배치 임포트 (id 제공 시 그대로 사용 → 멱등성 보장)
  app.post("/api/admin/import-features", requireAuth, async (req, res) => {
    if (req.headers["x-migrate-token"] !== MIGRATE_TOKEN) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { layerId, rows } = req.body as {
      layerId: string;
      rows: Array<{
        id?: string;
        geometry: any; properties: any;
        lng?: number; lat?: number;
        minLng?: number; minLat?: number; maxLng?: number; maxLat?: number;
      }>;
    };
    if (!layerId || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "layerId 및 rows[] 필요" });
    }
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const CHUNK = 500;
        let inserted = 0;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const params: any[] = [];
          const placeholders = chunk.map((r, j) => {
            const base = j * 10;
            params.push(
              r.id ?? null,
              layerId,
              JSON.stringify(r.geometry),
              JSON.stringify(r.properties),
              r.lng ?? null, r.lat ?? null,
              r.minLng ?? null, r.minLat ?? null,
              r.maxLng ?? null, r.maxLat ?? null
            );
            return `(COALESCE($${base+1}::varchar, gen_random_uuid()::varchar),$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10})`;
          });
          await client.query(
            `INSERT INTO features (id,layer_id,geometry,properties,lng,lat,min_lng,min_lat,max_lng,max_lat)
             VALUES ${placeholders.join(",")}
             ON CONFLICT (id) DO NOTHING`,
            params
          );
          inserted += chunk.length;
        }
        await client.query("COMMIT");

        // 임포트 완료 후 격자 캐시 자동 빌드 (백그라운드, 응답 차단 안함)
        const CELL_SIZE = GRID_CELL_SIZE;
        storage.buildGridCache(layerId, CELL_SIZE)
          .then(cnt => console.log(`[auto] Grid cache built for layer ${layerId}: ${cnt} cells`))
          .catch(err => console.error(`[auto] Grid cache build failed for ${layerId}:`, err?.message || err));

        res.json({ inserted });
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } catch (e: any) {
      console.error("import-features error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // 레이어 피처 전체 삭제 (재마이그레이션 전 정리용)
  app.post("/api/admin/clear-layer", requireAuth, async (req, res) => {
    if (req.headers["x-migrate-token"] !== MIGRATE_TOKEN) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { layerId } = req.body as { layerId: string };
    if (!layerId) return res.status(400).json({ error: "layerId 필요" });
    try {
      const result = await pool.query("DELETE FROM features WHERE layer_id=$1", [layerId]);
      await storage.refreshLayerStats(layerId);
      res.json({ deleted: result.rowCount });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 행정경계 배치 임포트 (id 보존)
  app.post("/api/admin/import-boundaries", requireAuth, async (req, res) => {
    if (req.headers["x-migrate-token"] !== MIGRATE_TOKEN) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { rows } = req.body as {
      rows: Array<{
        id: string; name: string; code: string; level: string; parentCode?: string;
        geometry: any; properties?: any;
        minLng?: number; minLat?: number; maxLng?: number; maxLat?: number;
        centerLng?: number; centerLat?: number;
      }>;
    };
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "rows[] 필요" });
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let inserted = 0;
        const CHUNK = 100;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const params: any[] = [];
          const placeholders = chunk.map((r, j) => {
            const base = j * 13;
            params.push(
              r.id, r.name, r.code, r.level, r.parentCode ?? null,
              JSON.stringify(r.geometry), JSON.stringify(r.properties ?? {}),
              r.minLng ?? null, r.minLat ?? null, r.maxLng ?? null, r.maxLat ?? null,
              r.centerLng ?? null, r.centerLat ?? null
            );
            return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13})`;
          });
          await client.query(
            `INSERT INTO administrative_boundaries (id,name,code,level,parent_code,geometry,properties,min_lng,min_lat,max_lng,max_lat,center_lng,center_lat)
             VALUES ${placeholders.join(",")} ON CONFLICT (id) DO NOTHING`,
            params
          );
          inserted += chunk.length;
        }
        await client.query("COMMIT");
        res.json({ inserted });
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 경계 집계 캐시 빌드 (레이어×레벨 단위, 기존 캐시 삭제 후 재계산)
  app.post("/api/admin/build-boundary-cache", requireAuth, async (req, res) => {
    if (req.headers["x-migrate-token"] !== MIGRATE_TOKEN) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { layerId, level } = req.body as { layerId: string; level: string };
    if (!layerId || !level) return res.status(400).json({ error: "layerId, level 필요" });
    try {
      // 기존 캐시 삭제 후 storage 함수(PIP 기반)로 재계산
      await pool.query(
        "DELETE FROM boundary_aggregate_cache WHERE layer_id=$1 AND level=$2",
        [layerId, level]
      );
      const rows = await storage.getBoundaryAggregation(layerId, level, [-180, -90, 180, 90]);
      res.json({ level, layerId, count: rows.length });
    } catch (e: any) {
      console.error("build-boundary-cache error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // 격자 집계 캐시 빌드 (≈300m 격자 전국 단위 사전 계산)
  // TODO: requireAdmin으로 전환 (구글 로그인 테스트 완료 후)
  app.post("/api/admin/build-grid-cache", requireAuth, async (req, res) => {
    const { layerId } = req.body;
    if (!layerId) return res.status(400).json({ error: "layerId required" });
    try {
      const CELL_SIZE = GRID_CELL_SIZE;
      const count = await storage.buildGridCache(layerId, CELL_SIZE);
      res.json({ layerId, cellSize: CELL_SIZE, count });
    } catch (e: any) {
      console.error("build-grid-cache error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // 공간인덱스 생성
  app.post("/api/admin/create-indexes", requireAuth, async (req, res) => {
    if (req.headers["x-migrate-token"] !== MIGRATE_TOKEN) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const client = await pool.connect();
    try {
      const indexes = [
        { name: "idx_features_layer_lat_lng", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_features_layer_lat_lng ON features (layer_id, lat, lng)" },
        { name: "idx_features_bbox", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_features_bbox ON features (min_lat, max_lat, min_lng, max_lng)" },
        { name: "idx_features_lat_lng", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_features_lat_lng ON features (lat, lng)" },
        { name: "idx_admin_bounds", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_bounds ON administrative_boundaries (level, min_lat, max_lat, min_lng, max_lng)" },
      ];
      const created: string[] = [];
      for (const idx of indexes) {
        await client.query(idx.sql);
        created.push(idx.name);
        console.log(`[index] created: ${idx.name}`);
      }
      res.json({ indexes: created });
    } catch (e: any) {
      console.error("create-indexes error:", e);
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  // 레이어 통계 재계산
  app.post("/api/admin/sync-layer-stats", requireAuth, async (req, res) => {
    if (req.headers["x-migrate-token"] !== MIGRATE_TOKEN) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { layerIds } = req.body as { layerIds: string[] };
    if (!Array.isArray(layerIds)) return res.status(400).json({ error: "layerIds[] 필요" });
    const results: { layerId: string; count: number }[] = [];
    for (const layerId of layerIds) {
      await storage.refreshLayerStats(layerId);
      const count = await storage.getFeatureCount(layerId);
      results.push({ layerId, count });
    }
    res.json({ results });
  });
  // ─────────────────────────────────────────────────────────────────────────

  // ── 글로벌 에러 핸들러 — asyncHandler 미적용 라우트도 안전하게 처리 ──
  app.use((err: any, _req: Request, res: Response, _next: Function) => {
    console.error("[Global Error Handler]", err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
