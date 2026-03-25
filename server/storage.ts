import {
  type User, type InsertUser,
  type Layer, type InsertLayer,
  type Feature, type InsertFeature,
  type SpatialQuery, type InsertSpatialQuery,
  type Basemap, type InsertBasemap,
  type AppSetting, type InsertAppSetting,
  type AdminBoundary, type InsertAdminBoundary,
  users, layers, features, spatialQueries, basemaps, appSettings, administrativeBoundaries, boundaryAggregateCache,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, sql, desc, asc } from "drizzle-orm";

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
  refreshLayerStats(layerId: string): Promise<void>;

  getFeaturesInRadius(lng: number, lat: number, radiusKm: number, layerIds?: string[]): Promise<Feature[]>;
  getFeaturesInBbox(layerId: string, bbox: number[], limit: number): Promise<{ count: number; features: { id: string; lng: number; lat: number; properties: any }[] }>;
  getGridAggregation(layerId: string, bbox: number[], gridSize: number): Promise<{ lng: number; lat: number; count: number }[]>;

  createSpatialQuery(query: InsertSpatialQuery): Promise<SpatialQuery>;
  getSpatialQueries(): Promise<SpatialQuery[]>;

  getBasemaps(): Promise<Basemap[]>;
  getBasemap(id: string): Promise<Basemap | undefined>;
  createBasemap(basemap: InsertBasemap): Promise<Basemap>;
  updateBasemap(id: string, updates: Partial<InsertBasemap>): Promise<Basemap | undefined>;
  deleteBasemap(id: string): Promise<boolean>;
  setDefaultBasemap(id: string): Promise<void>;

  getSettings(category?: string): Promise<AppSetting[]>;
  getSetting(key: string): Promise<AppSetting | undefined>;
  upsertSetting(setting: InsertAppSetting): Promise<AppSetting>;

  getAdminBoundaries(level?: string): Promise<AdminBoundary[]>;
  getAdminBoundary(id: string): Promise<AdminBoundary | undefined>;
  createAdminBoundaries(boundaries: InsertAdminBoundary[]): Promise<AdminBoundary[]>;
  deleteAdminBoundariesByLevel(level: string): Promise<number>;
  getAdminBoundaryLevels(): Promise<{ level: string; count: number }[]>;
  getBoundaryAggregation(layerId: string, level: string, bbox: number[]): Promise<{ boundaryId: string; name: string; code: string; count: number; centerLng: number; centerLat: number }[]>;
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
    return db.select().from(layers).orderBy(asc(layers.createdAt));
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
    await this.refreshLayerStats(feature.layerId);
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
      await this.refreshLayerStats(featureList[0].layerId);
    }
    return results;
  }

  async deleteFeature(id: string): Promise<boolean> {
    const feature = await this.getFeature(id);
    const result = await db.delete(features).where(eq(features.id, id)).returning();
    if (result.length > 0 && feature) {
      await this.refreshLayerStats(feature.layerId);
    }
    return result.length > 0;
  }

  async deleteFeaturesByLayer(layerId: string): Promise<number> {
    const result = await db.delete(features).where(eq(features.layerId, layerId)).returning();
    await this.refreshLayerStats(layerId);
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

  async getFeaturesInBbox(layerId: string, bbox: number[], limit: number): Promise<{ count: number; features: { id: string; lng: number; lat: number; properties: any }[] }> {
    const [minLng, minLat, maxLng, maxLat] = bbox;

    const countResult = await db.execute(sql`
      SELECT count(*)::int as total FROM ${features}
      WHERE ${features.layerId} = ${layerId}
        AND ${features.lng} >= ${minLng}::float AND ${features.lng} <= ${maxLng}::float
        AND ${features.lat} >= ${minLat}::float AND ${features.lat} <= ${maxLat}::float
    `);
    const total = (countResult.rows[0] as any).total;

    const result = await db.execute(sql`
      SELECT id, lng, lat, properties FROM ${features}
      WHERE ${features.layerId} = ${layerId}
        AND ${features.lng} >= ${minLng}::float AND ${features.lng} <= ${maxLng}::float
        AND ${features.lat} >= ${minLat}::float AND ${features.lat} <= ${maxLat}::float
      LIMIT ${limit}
    `);

    return {
      count: total,
      features: (result.rows as any[]).map(r => ({
        id: r.id,
        lng: r.lng,
        lat: r.lat,
        properties: r.properties,
      })),
    };
  }

  async getGridAggregation(layerId: string, bbox: number[], gridSize: number): Promise<{ lng: number; lat: number; count: number }[]> {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const lngStep = (maxLng - minLng) / gridSize;
    const latStep = (maxLat - minLat) / gridSize;

    const result = await db.execute(sql`
      SELECT
        avg(${features.lng})::float as lng,
        avg(${features.lat})::float as lat,
        count(*)::int as count
      FROM ${features}
      WHERE ${features.layerId} = ${layerId}
        AND ${features.lng} >= ${minLng}::float
        AND ${features.lng} <= ${maxLng}::float
        AND ${features.lat} >= ${minLat}::float
        AND ${features.lat} <= ${maxLat}::float
      GROUP BY
        floor((${features.lng} - ${minLng}::float) / ${lngStep}::float),
        floor((${features.lat} - ${minLat}::float) / ${latStep}::float)
      HAVING count(*) > 0
      ORDER BY count DESC
      LIMIT 500
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

  async getBasemaps(): Promise<Basemap[]> {
    return db.select().from(basemaps).orderBy(asc(basemaps.sortOrder));
  }

  async getBasemap(id: string): Promise<Basemap | undefined> {
    const [basemap] = await db.select().from(basemaps).where(eq(basemaps.id, id));
    return basemap || undefined;
  }

  async createBasemap(basemap: InsertBasemap): Promise<Basemap> {
    const [created] = await db.insert(basemaps).values(basemap).returning();
    return created;
  }

  async updateBasemap(id: string, updates: Partial<InsertBasemap>): Promise<Basemap | undefined> {
    const [updated] = await db.update(basemaps).set(updates).where(eq(basemaps.id, id)).returning();
    return updated || undefined;
  }

  async deleteBasemap(id: string): Promise<boolean> {
    const result = await db.delete(basemaps).where(eq(basemaps.id, id)).returning();
    return result.length > 0;
  }

  async setDefaultBasemap(id: string): Promise<void> {
    await db.update(basemaps).set({ isDefault: false });
    await db.update(basemaps).set({ isDefault: true }).where(eq(basemaps.id, id));
  }

  async getSettings(category?: string): Promise<AppSetting[]> {
    if (category) {
      return db.select().from(appSettings).where(eq(appSettings.category, category));
    }
    return db.select().from(appSettings);
  }

  async getSetting(key: string): Promise<AppSetting | undefined> {
    const [setting] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return setting || undefined;
  }

  async upsertSetting(setting: InsertAppSetting): Promise<AppSetting> {
    const [result] = await db
      .insert(appSettings)
      .values(setting)
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: setting.value, description: setting.description, category: setting.category },
      })
      .returning();
    return result;
  }

  async getAdminBoundaries(level?: string): Promise<AdminBoundary[]> {
    if (level) {
      return db.select().from(administrativeBoundaries).where(eq(administrativeBoundaries.level, level));
    }
    return db.select().from(administrativeBoundaries);
  }

  async getAdminBoundary(id: string): Promise<AdminBoundary | undefined> {
    const [boundary] = await db.select().from(administrativeBoundaries).where(eq(administrativeBoundaries.id, id));
    return boundary || undefined;
  }

  async createAdminBoundaries(boundaryList: InsertAdminBoundary[]): Promise<AdminBoundary[]> {
    if (boundaryList.length === 0) return [];
    const batchSize = 50;
    const results: AdminBoundary[] = [];
    for (let i = 0; i < boundaryList.length; i += batchSize) {
      const batch = boundaryList.slice(i, i + batchSize);
      const created = await db.insert(administrativeBoundaries).values(batch).returning();
      results.push(...created);
    }
    return results;
  }

  async deleteAdminBoundariesByLevel(level: string): Promise<number> {
    const result = await db.delete(administrativeBoundaries).where(eq(administrativeBoundaries.level, level)).returning();
    return result.length;
  }

  async getAdminBoundaryLevels(): Promise<{ level: string; count: number }[]> {
    const result = await db.execute(sql`
      SELECT level, count(*)::int as count
      FROM administrative_boundaries
      GROUP BY level
      ORDER BY level
    `);
    return (result.rows as any[]).map(r => ({ level: r.level, count: r.count }));
  }

  async getBoundaryAggregation(layerId: string, level: string, bbox: number[]): Promise<{ boundaryId: string; name: string; code: string; count: number; centerLng: number; centerLat: number }[]> {
    const [minLng, minLat, maxLng, maxLat] = bbox;

    const cached = await db.select().from(boundaryAggregateCache)
      .where(and(
        eq(boundaryAggregateCache.layerId, layerId),
        eq(boundaryAggregateCache.level, level),
      ));

    if (cached.length > 0) {
      return cached
        .filter(c => c.centerLng <= maxLng && c.centerLng >= minLng && c.centerLat <= maxLat && c.centerLat >= minLat)
        .map(c => ({
          boundaryId: c.boundaryId,
          name: c.boundaryName,
          code: c.boundaryCode,
          count: c.count,
          centerLng: c.centerLng,
          centerLat: c.centerLat,
        }))
        .sort((a, b) => b.count - a.count);
    }

    // PostGIS ST_Within으로 정확한 PIP 집계 (hole/inner ring 포함 처리)
    const pipResult = await db.execute(sql`
      SELECT
        ab.id          AS boundary_id,
        ab.name,
        ab.code,
        ab.center_lng,
        ab.center_lat,
        COUNT(f.id)::int AS count
      FROM administrative_boundaries ab
      LEFT JOIN features f
        ON f.layer_id = ${layerId}
        AND f.lat IS NOT NULL
        AND f.lng IS NOT NULL
        AND ST_Within(f.geom, ab.geom)
      WHERE ab.level = ${level}
      GROUP BY ab.id, ab.name, ab.code, ab.center_lng, ab.center_lat
      ORDER BY count DESC
    `);

    const rows = (pipResult.rows as any[]).map(r => ({
      boundaryId: r.boundary_id as string,
      name: r.name as string,
      code: r.code as string,
      count: r.count as number,
      centerLng: r.center_lng as number,
      centerLat: r.center_lat as number,
    }));

    const cacheRows = rows.map(r => ({
      layerId,
      level,
      boundaryId: r.boundaryId,
      boundaryName: r.name,
      boundaryCode: r.code,
      count: r.count,
      centerLng: r.centerLng,
      centerLat: r.centerLat,
    }));
    for (let i = 0; i < cacheRows.length; i += 50) {
      await db.insert(boundaryAggregateCache).values(cacheRows.slice(i, i + 50));
    }

    return rows
      .filter(r => r.centerLng <= maxLng && r.centerLng >= minLng && r.centerLat <= maxLat && r.centerLat >= minLat);
  }

  async refreshLayerStats(layerId: string): Promise<void> {
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
