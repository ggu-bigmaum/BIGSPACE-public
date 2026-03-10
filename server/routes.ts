import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLayerSchema, insertFeatureSchema, insertBasemapSchema, insertAppSettingSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Layer CRUD
  app.get("/api/layers", async (_req, res) => {
    const layers = await storage.getLayers();
    res.json(layers);
  });

  app.get("/api/layers/:id", async (req, res) => {
    const layer = await storage.getLayer(req.params.id);
    if (!layer) return res.status(404).json({ message: "Layer not found" });
    res.json(layer);
  });

  app.post("/api/layers", async (req, res) => {
    try {
      const data = insertLayerSchema.parse(req.body);
      const layer = await storage.createLayer(data);
      res.status(201).json(layer);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  const layerUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    category: z.string().transform(v => v.trim() || "일반").optional(),
    visible: z.boolean().optional(),
    opacity: z.number().min(0).max(1).optional(),
    strokeColor: z.string().optional(),
    fillColor: z.string().optional(),
    strokeWidth: z.number().min(0.5).max(10).optional(),
    pointRadius: z.number().min(1).max(20).optional(),
    renderMode: z.enum(["auto", "feature", "tile", "aggregate"]).optional(),
    featureLimit: z.number().int().min(100).max(50000).optional(),
    minZoomForFeatures: z.number().int().min(0).max(22).optional(),
    tileEnabled: z.boolean().optional(),
    tileMaxZoom: z.number().int().min(0).max(22).optional(),
  }).strict();

  app.patch("/api/layers/:id", async (req, res) => {
    const parsed = layerUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "잘못된 요청 데이터", errors: parsed.error.flatten() });
    }
    const layer = await storage.updateLayer(req.params.id, parsed.data);
    if (!layer) return res.status(404).json({ message: "Layer not found" });
    res.json(layer);
  });

  app.delete("/api/layers/:id", async (req, res) => {
    const ok = await storage.deleteLayer(req.params.id);
    if (!ok) return res.status(404).json({ message: "Layer not found" });
    res.json({ success: true });
  });

  // Feature API with BBOX filtering
  app.get("/api/layers/:id/features", async (req, res) => {
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

  app.post("/api/layers/:id/features", async (req, res) => {
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

  app.delete("/api/layers/:id/features", async (req, res) => {
    const count = await storage.deleteFeaturesByLayer(req.params.id);
    res.json({ deleted: count });
  });

  // Grid aggregation for low zoom
  app.get("/api/layers/:id/aggregate", async (req, res) => {
    const { bbox, gridSize } = req.query;
    if (!bbox || typeof bbox !== "string") {
      return res.status(400).json({ message: "bbox required" });
    }
    const parsedBbox = (bbox as string).split(",").map(Number);
    if (parsedBbox.length !== 4) return res.status(400).json({ message: "Invalid bbox" });

    const size = gridSize ? parseInt(gridSize as string, 10) : 20;
    const grid = await storage.getGridAggregation(req.params.id, parsedBbox, size);
    res.json(grid);
  });

  // Spatial query: radius search
  app.get("/api/spatial/radius", async (req, res) => {
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
  app.get("/api/spatial/history", async (_req, res) => {
    const queries = await storage.getSpatialQueries();
    res.json(queries);
  });

  // Basemap CRUD
  app.get("/api/basemaps", async (_req, res) => {
    const list = await storage.getBasemaps();
    res.json(list);
  });

  app.post("/api/basemaps", async (req, res) => {
    try {
      const data = insertBasemapSchema.parse(req.body);
      const basemap = await storage.createBasemap(data);
      res.status(201).json(basemap);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/basemaps/:id", async (req, res) => {
    try {
      const allowedFields = insertBasemapSchema.partial().parse(req.body);
      const basemap = await storage.updateBasemap(req.params.id, allowedFields);
      if (!basemap) return res.status(404).json({ message: "Basemap not found" });
      res.json(basemap);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/basemaps/:id", async (req, res) => {
    const ok = await storage.deleteBasemap(req.params.id);
    if (!ok) return res.status(404).json({ message: "Basemap not found" });
    res.json({ success: true });
  });

  app.post("/api/basemaps/:id/default", async (req, res) => {
    await storage.setDefaultBasemap(req.params.id);
    res.json({ success: true });
  });

  // App settings
  app.get("/api/settings", async (req, res) => {
    const category = req.query.category as string | undefined;
    const settings = await storage.getSettings(category);
    res.json(settings);
  });

  app.get("/api/settings/:key", async (req, res) => {
    const setting = await storage.getSetting(req.params.key);
    if (!setting) return res.status(404).json({ message: "Setting not found" });
    res.json(setting);
  });

  app.put("/api/settings/:key", async (req, res) => {
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

  // Stats endpoint
  app.get("/api/stats", async (_req, res) => {
    const allLayers = await storage.getLayers();
    const totalFeatures = allLayers.reduce((sum, l) => sum + l.featureCount, 0);
    res.json({
      layerCount: allLayers.length,
      totalFeatures,
      layers: allLayers.map(l => ({ id: l.id, name: l.name, featureCount: l.featureCount })),
    });
  });

  return httpServer;
}
