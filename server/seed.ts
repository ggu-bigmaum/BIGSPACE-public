import { storage } from "./storage";
import { db } from "./db";
import { layers, basemaps } from "@shared/schema";
import { eq } from "drizzle-orm";
import { fetchVWorldMaxScale } from "./wmsUtils";

async function upsertBasemaps() {
  console.log("Upserting basemaps...");

  const kakaoKey = process.env.KAKAO_JS_KEY || process.env.VITE_KAKAO_JS_KEY || "";
  const ncpClientId = process.env.NCP_CLIENT_ID || process.env.VITE_NCP_CLIENT_ID || "";
  const vworldKey = process.env.VWORLD_KEY || process.env.VITE_VWORLD_KEY || "";

  const defaultBasemaps = [
    {
      name: "위성 영상",
      provider: "esri",
      urlTemplate: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      apiKey: null,
      enabled: true,
      isDefault: false,
      sortOrder: -1,
      attribution: "© Esri, Maxar, Earthstar Geographics",
      maxZoom: 19,
      subdomains: null,
      description: "ESRI 위성영상 지도. API 키 불필요.",
    },
    {
      name: "OpenStreetMap",
      provider: "osm",
      urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      apiKey: null,
      enabled: true,
      isDefault: false,
      sortOrder: 0,
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
      subdomains: null,
      description: "전 세계 오픈소스 지도. API 키 불필요.",
    },
    {
      name: "VWorld 기본지도",
      provider: "vworld",
      urlTemplate: "https://api.vworld.kr/req/wmts/1.0.0/{apiKey}/Base/{z}/{y}/{x}.png",
      apiKey: vworldKey || "",
      enabled: true,
      isDefault: true,
      sortOrder: 1,
      attribution: "© VWorld (국토정보플랫폼)",
      maxZoom: 18,
      subdomains: null,
      description: "국토교통부 제공 기본지도. api.vworld.kr에서 API 키 발급 필요.",
    },
    {
      name: "VWorld 위성지도",
      provider: "vworld",
      urlTemplate: "https://api.vworld.kr/req/wmts/1.0.0/{apiKey}/Satellite/{z}/{y}/{x}.jpeg",
      apiKey: vworldKey || "",
      enabled: true,
      isDefault: false,
      sortOrder: 2,
      attribution: "© VWorld (국토정보플랫폼)",
      maxZoom: 18,
      subdomains: null,
      description: "VWorld 위성영상 지도. 동일한 VWorld API 키 사용.",
    },
    {
      name: "네이버 지도",
      provider: "naver",
      urlTemplate: "/api/proxy/naver-tiles/{z}/{x}/{y}",
      apiKey: ncpClientId || "",
      enabled: true,
      isDefault: false,
      sortOrder: 3,
      attribution: "© Naver Corp.",
      maxZoom: 21,
      subdomains: null,
      description: "네이버 클라우드 플랫폼 지도. 서버 프록시를 통해 타일 제공.",
    },
    {
      name: "카카오 지도",
      provider: "kakao",
      urlTemplate: "",
      apiKey: kakaoKey || "",
      enabled: true,
      isDefault: false,
      sortOrder: 4,
      attribution: "© Kakao Corp.",
      maxZoom: 21,
      subdomains: null,
      description: "카카오 지도 SDK 연동. 도로, 위성, 하이브리드 맵 지원.",
    },
  ];

  for (const bm of defaultBasemaps) {
    const existing = await db.select().from(basemaps).where(eq(basemaps.name, bm.name));
    if (existing.length > 0) {
      await db.update(basemaps).set({
        provider: bm.provider,
        urlTemplate: bm.urlTemplate,
        apiKey: bm.apiKey,
        enabled: bm.enabled,
        isDefault: bm.isDefault,
        sortOrder: bm.sortOrder,
        attribution: bm.attribution,
        maxZoom: bm.maxZoom,
        description: bm.description,
      }).where(eq(basemaps.name, bm.name));
    } else {
      await storage.createBasemap(bm);
    }
  }

  console.log("Basemaps upserted: ESRI, OSM, VWorld, Naver, Kakao");
}

async function upsertSettings() {
  console.log("Upserting settings...");

  const defaultSettings = [
    {
      key: "rendering.defaultRenderMode",
      value: "auto",
      description: "기본 렌더링 모드. auto: 줌 레벨에 따라 자동 전환 | feature: 항상 개별 피처 표시 | tile: 타일 기반 표시 | aggregate: 집계 클러스터만 표시",
      category: "rendering",
    },
    {
      key: "rendering.defaultFeatureLimit",
      value: 2000,
      description: "한 번에 로드할 최대 피처 수. 값이 클수록 상세하지만 성능이 저하됩니다. 권장: 1000~5000",
      category: "rendering",
    },
    {
      key: "rendering.defaultMinZoomForFeatures",
      value: 15,
      description: "개별 피처를 표시하는 최소 줌 레벨. 이보다 낮은 줌에서는 집계/클러스터로 표시됩니다. 범위: 0~20",
      category: "rendering",
    },
    {
      key: "rendering.aggregateGridSize",
      value: 20,
      description: "저줌 집계(aggregate) 시 그리드 분할 수. 값이 클수록 촘촘한 집계. 권장: 10~40",
      category: "rendering",
    },
    {
      key: "rendering.debounceMs",
      value: 300,
      description: "지도 이동/줌 시 데이터 요청 디바운스 시간(ms). 값이 작으면 반응이 빠르지만 서버 부하가 증가합니다. 권장: 200~500",
      category: "rendering",
    },
    {
      key: "map.defaultCenter",
      value: [126.978, 37.5665],
      description: "지도 초기 중심 좌표 [경도, 위도]. 서울: [126.978, 37.5665]",
      category: "map",
    },
    {
      key: "map.defaultZoom",
      value: 11,
      description: "지도 초기 줌 레벨. 범위: 2~20. 도시 전체 보기: 11, 구/동 단위: 14~15",
      category: "map",
    },
    {
      key: "map.maxZoom",
      value: 20,
      description: "최대 줌 레벨. 범위: 15~22",
      category: "map",
    },
    {
      key: "map.minZoom",
      value: 2,
      description: "최소 줌 레벨. 범위: 0~10",
      category: "map",
    },
  ];

  for (const s of defaultSettings) {
    await storage.upsertSetting(s);
  }

  console.log("Settings upserted");
}

async function upsertEmergencyLayers() {
  const existingLayers = await storage.getLayers();
  const existingNames = new Set(existingLayers.map(l => l.name));

  // 데이터 없는 21/22 레이어 삭제
  for (const layer of existingLayers) {
    if (layer.name === "응급출동 현황 2021" || layer.name === "응급출동 현황 2022") {
      await storage.deleteLayer(layer.id);
      console.log(`Removed empty layer: ${layer.name}`);
    }
  }

  // 샘플 레이어 카테고리 통합
  for (const layer of existingLayers) {
    if (["인프라", "교통", "행정"].includes(layer.category || "")) {
      await storage.updateLayer(layer.id, { category: "공간데이터" });
    }
  }

  if (!existingNames.has("응급출동 현황 2020")) {
    await storage.createLayer({
      name: "응급출동 현황 2020",
      description: "소방청 구급출동 데이터 (2020년)",
      category: "응급출동",
      geometryType: "Point" as const,
      srid: 4326,
      renderMode: "auto" as const,
      featureLimit: 5000,
      minZoomForFeatures: 14,
      minZoomForClusters: 8,
      tileEnabled: true,
      tileMaxZoom: 14,
      visible: true,
      opacity: 0.7,
      strokeColor: "#65a30d",
      fillColor: "#65a30d40",
      strokeWidth: 1,
      pointRadius: 4,
    });
    console.log("Created layer metadata: 응급출동 현황 2020");
  }
}

async function upsertBoundaryLayers() {
  const existingLayers = await storage.getLayers();
  const existingNames = new Set(existingLayers.map(l => l.name));

  const boundaryLayers = [
    { name: "시도 경계", level: "시도", color: "#6366f1", width: 2.5, opacity: 0.6 },
    { name: "시군구 경계", level: "시군구", color: "#8b5cf6", width: 1.5, opacity: 0.5 },
    { name: "읍면동 경계", level: "읍면동", color: "#a78bfa", width: 1, opacity: 0.4 },
  ];

  for (const bl of boundaryLayers) {
    if (existingNames.has(bl.name)) continue;
    await storage.createLayer({
      name: bl.name,
      description: `internal://admin-boundaries?level=${bl.level}`,
      category: "행정경계",
      geometryType: "Polygon",
      srid: 4326,
      renderMode: "feature",
      featureLimit: 5000,
      minZoomForFeatures: 0,
      minZoomForClusters: 0,
      tileEnabled: false,
      tileMaxZoom: 14,
      visible: false,
      opacity: bl.opacity,
      strokeColor: bl.color,
      fillColor: bl.color + "15",
      strokeWidth: bl.width,
      pointRadius: 4,
    });
    console.log(`Created boundary layer: ${bl.name}`);
  }
}

async function upsertVWorldLayers() {
  const existingLayers = await storage.getLayers();
  const existingNames = new Set(existingLayers.map(l => l.name));

  const vworldLayers = [
    {
      name: "도시지역",
      description: "용도지역도 — 도시지역 (lt_c_uq111)",
      category: "VWorld",
      subCategory: "용도지역",
      wmsLayers: "lt_c_uq111",
    },
  ];

  const apiKey = process.env.VWORLD_KEY || process.env.VITE_VWORLD_KEY || "";

  for (const vl of vworldLayers) {
    const maxScale = await fetchVWorldMaxScale(vl.wmsLayers, apiKey);
    if (maxScale !== null) {
      console.log(`VWorld ${vl.name}(${vl.wmsLayers}) maxScaleDenominator 자동감지: ${maxScale}`);
    }

    // 기존 레이어면 maxScaleDenominator만 업데이트
    const existing = existingLayers.find(l => l.name === vl.name);
    if (existing) {
      if (maxScale !== null && existing.maxScaleDenominator !== maxScale) {
        await storage.updateLayer(existing.id, { maxScaleDenominator: maxScale });
        console.log(`VWorld ${vl.name} maxScaleDenominator 업데이트: ${maxScale}`);
      }
      continue;
    }

    await storage.createLayer({
      name: vl.name,
      description: vl.description,
      category: vl.category,
      subCategory: vl.subCategory,
      geometryType: "Polygon",
      srid: 4326,
      renderMode: "feature",
      featureLimit: 5000,
      minZoomForFeatures: 0,
      minZoomForClusters: 0,
      tileEnabled: false,
      tileMaxZoom: 14,
      visible: false,
      opacity: 0.8,
      strokeColor: "#6366f1",
      fillColor: "#6366f130",
      strokeWidth: 1,
      pointRadius: 4,
      wmsUrl: "/api/proxy/wms",
      wmsLayers: vl.wmsLayers,
      maxScaleDenominator: maxScale ?? undefined,
    });
    console.log(`Created VWorld layer: ${vl.name}`);
  }
}

export async function seedDatabase() {
  await upsertBasemaps();
  await upsertSettings();
  await upsertEmergencyLayers();
  await upsertBoundaryLayers();
  await upsertVWorldLayers();

  // 샘플 레이어 자동 생성 제거됨 — 불필요한 데모 데이터 재생성 방지
  console.log("Seed complete.");
}

