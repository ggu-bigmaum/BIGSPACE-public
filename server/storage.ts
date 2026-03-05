import {
  type User, type InsertUser,
  type Layer, type InsertLayer,
  type Feature, type InsertFeature,
  type SpatialQuery, type InsertSpatialQuery,
  users, layers, features, spatialQueries,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getLayers(): Promise<Layer[]>;
  getLayer(id: string): Promise<Layer | undefined>;
  createLayer(layer: InsertLayer): Promise<Layer>;
  updateLayer(id: string, layer: Partial<InsertLayer>): Promise<Layer | undefined>;
  deleteLayer(id: string): Promise<boolean>;

  getFeaturesByLayer(layerId: string, bbox?: number[], limit?: number): Promise<Feature[]>;
  getFeature(id: string): Promise<Feature | undefined>;
  createFeature(feature: InsertFeature): Promise<Feature>;
  createFeatures(features: InsertFeature[]): Promise<Feature[]>;
  deleteFeature(id: string): Promise<boolean>;
  deleteFeaturesByLayer(layerId: string): Promise<number>;
  getFeatureCount(layerId: string): Promise<number>;

  getFeaturesInRadius(lng: number, lat: number, radiusKm: number, layerIds?: string[]): Promise<Feature[]>;
  getGridAggregation(layerId: string, bbox: number[], gridSize: number): Promise<{ lng: number; lat: number; count: number }[]>;

  createSpatialQuery(query: InsertSpatialQuery): Promise<SpatialQuery>;
  getSpatialQueries(): Promise<SpatialQuery[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getLayers(): Promise<Layer[]> {
    return db.select().from(layers).orderBy(desc(layers.createdAt));
  }

  async getLayer(id: string): Promise<Layer | undefined> {
    const [layer] = await db.select().from(layers).where(eq(layers.id, id));
    return layer || undefined;
  }

  async createLayer(layer: InsertLayer): Promise<Layer> {
    const [created] = await db.insert(layers).values(layer).returning();
    return created;
  }

  async updateLayer(id: string, updates: Partial<InsertLayer>): Promise<Layer | undefined> {
    const [updated] = await db.update(layers).set(updates).where(eq(layers.id, id)).returning();
    return updated || undefined;
  }

  async deleteLayer(id: string): Promise<boolean> {
    await db.delete(features).where(eq(features.layerId, id));
    const result = await db.delete(layers).where(eq(layers.id, id)).returning();
    return result.length > 0;
  }

  async getFeaturesByLayer(layerId: string, bbox?: number[], limit: number = 2000): Promise<Feature[]> {
    const conditions = [eq(features.layerId, layerId)];

    if (bbox && bbox.length === 4) {
      const [bboxMinLng, bboxMinLat, bboxMaxLng, bboxMaxLat] = bbox;
      conditions.push(lte(features.minLng!, bboxMaxLng));
      conditions.push(gte(features.maxLng!, bboxMinLng));
      conditions.push(lte(features.minLat!, bboxMaxLat));
      conditions.push(gte(features.maxLat!, bboxMinLat));
    }

    return db.select().from(features).where(and(...conditions)).limit(limit);
  }

  async getFeature(id: string): Promise<Feature | undefined> {
    const [feature] = await db.select().from(features).where(eq(features.id, id));
    return feature || undefined;
  }

  async createFeature(feature: InsertFeature): Promise<Feature> {
    const enriched = this.enrichFeatureCoords(feature);
    const [created] = await db.insert(features).values(enriched).returning();
    await this.updateLayerStats(feature.layerId);
    return created;
  }

  async createFeatures(featureList: InsertFeature[]): Promise<Feature[]> {
    if (featureList.length === 0) return [];
    const enriched = featureList.map(f => this.enrichFeatureCoords(f));
    const batchSize = 500;
    const results: Feature[] = [];
    for (let i = 0; i < enriched.length; i += batchSize) {
      const batch = enriched.slice(i, i + batchSize);
      const created = await db.insert(features).values(batch).returning();
      results.push(...created);
    }
    if (featureList.length > 0) {
      await this.updateLayerStats(featureList[0].layerId);
    }
    return results;
  }

  async deleteFeature(id: string): Promise<boolean> {
    const feature = await this.getFeature(id);
    const result = await db.delete(features).where(eq(features.id, id)).returning();
    if (result.length > 0 && feature) {
      await this.updateLayerStats(feature.layerId);
    }
    return result.length > 0;
  }

  async deleteFeaturesByLayer(layerId: string): Promise<number> {
    const result = await db.delete(features).where(eq(features.layerId, layerId)).returning();
    await this.updateLayerStats(layerId);
    return result.length;
  }

  async getFeatureCount(layerId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(features).where(eq(features.layerId, layerId));
    return result[0]?.count || 0;
  }

  async getFeaturesInRadius(lng: number, lat: number, radiusKm: number, layerIds?: string[]): Promise<Feature[]> {
    const degPerKm = 1 / 111.32;
    const radiusDeg = radiusKm * degPerKm;

    const conditions = [
      gte(features.lng!, lng - radiusDeg),
      lte(features.lng!, lng + radiusDeg),
      gte(features.lat!, lat - radiusDeg),
      lte(features.lat!, lat + radiusDeg),
    ];

    if (layerIds && layerIds.length > 0) {
      conditions.push(sql`${features.layerId} = ANY(${layerIds})`);
    }

    const results = await db.select().from(features).where(and(...conditions)).limit(5000);

    return results.filter(f => {
      if (f.lng == null || f.lat == null) return false;
      const dx = (f.lng - lng) * Math.cos((lat * Math.PI) / 180);
      const dy = f.lat - lat;
      const dist = Math.sqrt(dx * dx + dy * dy) * 111.32;
      return dist <= radiusKm;
    });
  }

  async getGridAggregation(layerId: string, bbox: number[], gridSize: number): Promise<{ lng: number; lat: number; count: number }[]> {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const lngStep = (maxLng - minLng) / gridSize;
    const latStep = (maxLat - minLat) / gridSize;

    const result = await db.execute(sql`
      SELECT
        floor((${features.lng} - ${minLng}::float) / ${lngStep}::float) * ${lngStep}::float + ${minLng}::float + ${lngStep}::float/2 as lng,
        floor((${features.lat} - ${minLat}::float) / ${latStep}::float) * ${latStep}::float + ${minLat}::float + ${latStep}::float/2 as lat,
        count(*)::int as count
      FROM ${features}
      WHERE ${features.layerId} = ${layerId}
        AND ${features.lng} >= ${minLng}::float
        AND ${features.lng} <= ${maxLng}::float
        AND ${features.lat} >= ${minLat}::float
        AND ${features.lat} <= ${maxLat}::float
      GROUP BY 1, 2
      HAVING count(*) > 0
      ORDER BY count DESC
      LIMIT 1000
    `);

    return (result.rows as any[]).map(r => ({
      lng: parseFloat(r.lng),
      lat: parseFloat(r.lat),
      count: parseInt(r.count),
    }));
  }

  async createSpatialQuery(query: InsertSpatialQuery): Promise<SpatialQuery> {
    const [created] = await db.insert(spatialQueries).values(query).returning();
    return created;
  }

  async getSpatialQueries(): Promise<SpatialQuery[]> {
    return db.select().from(spatialQueries).orderBy(desc(spatialQueries.createdAt)).limit(50);
  }

  private enrichFeatureCoords(feature: InsertFeature): InsertFeature {
    const geom = feature.geometry as any;
    if (!geom || !geom.type) return feature;

    if (geom.type === "Point" && geom.coordinates) {
      return {
        ...feature,
        lng: geom.coordinates[0],
        lat: geom.coordinates[1],
        minLng: geom.coordinates[0],
        minLat: geom.coordinates[1],
        maxLng: geom.coordinates[0],
        maxLat: geom.coordinates[1],
      };
    }

    const coords = this.flattenCoords(geom);
    if (coords.length > 0) {
      const lngs = coords.map(c => c[0]);
      const lats = coords.map(c => c[1]);
      const centroidLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      const centroidLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      return {
        ...feature,
        lng: centroidLng,
        lat: centroidLat,
        minLng: Math.min(...lngs),
        minLat: Math.min(...lats),
        maxLng: Math.max(...lngs),
        maxLat: Math.max(...lats),
      };
    }

    return feature;
  }

  private flattenCoords(geom: any): number[][] {
    if (geom.type === "Point") return [geom.coordinates];
    if (geom.type === "MultiPoint" || geom.type === "LineString") return geom.coordinates;
    if (geom.type === "MultiLineString" || geom.type === "Polygon") return geom.coordinates.flat();
    if (geom.type === "MultiPolygon") return geom.coordinates.flat(2);
    return [];
  }

  private async updateLayerStats(layerId: string): Promise<void> {
    const count = await this.getFeatureCount(layerId);
    const boundsResult = await db.execute(sql`
      SELECT
        min(${features.minLng}) as min_lng,
        min(${features.minLat}) as min_lat,
        max(${features.maxLng}) as max_lng,
        max(${features.maxLat}) as max_lat
      FROM ${features}
      WHERE ${features.layerId} = ${layerId}
    `);
    const b = boundsResult.rows[0] as any;
    const bounds = b && b.min_lng != null ? [b.min_lng, b.min_lat, b.max_lng, b.max_lat] : null;
    await db.update(layers).set({ featureCount: count, bounds }).where(eq(layers.id, layerId));
  }
}

export const storage = new DatabaseStorage();
