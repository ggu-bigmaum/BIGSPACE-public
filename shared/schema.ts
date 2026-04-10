import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, real, jsonb, timestamp, index, foreignKey, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("admin"), // "admin" | "viewer" — 데모: 전원 admin, 운영 전환 시 "viewer"로 변경
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ── 감사 추적 로그 (GS 인증 1-4) ────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  username: text("username"),
  action: text("action").notNull(),           // "LOGIN" | "LOGOUT" | "CREATE" | "UPDATE" | "DELETE" | "UPLOAD" etc.
  resource: text("resource"),                  // "layer" | "feature" | "settings" etc.
  resourceId: varchar("resource_id"),
  ip: text("ip").notNull(),
  userAgent: text("user_agent"),
  details: jsonb("details"),                   // 추가 정보 (변경 전/후 등)
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_audit_logs_created_at").on(table.createdAt),
  index("idx_audit_logs_user_id").on(table.userId),
  foreignKey({ columns: [table.userId], foreignColumns: [users.id] }).onDelete("set null"),
]);

export type AuditLog = typeof auditLogs.$inferSelect;

export const layers = pgTable("layers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("일반"),
  subCategory: text("sub_category"),
  geometryType: text("geometry_type").notNull().default("Point"),
  srid: integer("srid").notNull().default(4326),
  renderMode: text("render_mode").notNull().default("auto"),
  featureLimit: integer("feature_limit").notNull().default(5000),
  minZoomForFeatures: integer("min_zoom_for_features").notNull().default(17),
  minZoomForClusters: integer("min_zoom_for_clusters").notNull().default(7),
  tileEnabled: boolean("tile_enabled").notNull().default(true),
  tileMaxZoom: integer("tile_max_zoom").notNull().default(14),
  visible: boolean("visible").notNull().default(true),
  opacity: real("opacity").notNull().default(1),
  strokeColor: text("stroke_color").notNull().default("#0d9488"),
  fillColor: text("fill_color").notNull().default("#0d948850"),
  strokeWidth: real("stroke_width").notNull().default(2),
  pointRadius: real("point_radius").notNull().default(6),
  sortOrder: integer("sort_order").notNull().default(0),
  featureCount: integer("feature_count").notNull().default(0),
  bounds: jsonb("bounds"),
  wmsUrl: text("wms_url"),
  wmsLayers: text("wms_layers"),
  wfsUrl: text("wfs_url"),
  wfsLayers: text("wfs_layers"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const layersRelations = relations(layers, ({ many }) => ({
  features: many(features),
}));

export const insertLayerSchema = createInsertSchema(layers).omit({
  id: true,
  featureCount: true,
  bounds: true,
  createdAt: true,
});

export type InsertLayer = z.infer<typeof insertLayerSchema>;
export type Layer = typeof layers.$inferSelect;

export const features = pgTable("features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  layerId: varchar("layer_id").notNull(),
  geometry: jsonb("geometry").notNull(),
  properties: jsonb("properties").notNull().default({}),
  lng: real("lng"),
  lat: real("lat"),
  minLng: real("min_lng"),
  minLat: real("min_lat"),
  maxLng: real("max_lng"),
  maxLat: real("max_lat"),
}, (table) => [
  index("idx_features_layer_id").on(table.layerId),
  index("idx_features_layer_lng_lat").on(table.layerId, table.lng, table.lat),
  foreignKey({ columns: [table.layerId], foreignColumns: [layers.id] }).onDelete("cascade"),
]);

export const featuresRelations = relations(features, ({ one }) => ({
  layer: one(layers, {
    fields: [features.layerId],
    references: [layers.id],
  }),
}));

export const insertFeatureSchema = createInsertSchema(features).omit({
  id: true,
});

export type InsertFeature = z.infer<typeof insertFeatureSchema>;
export type Feature = typeof features.$inferSelect;

export const basemaps = pgTable("basemaps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  urlTemplate: text("url_template").notNull(),
  apiKey: text("api_key"),
  enabled: boolean("enabled").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  attribution: text("attribution"),
  maxZoom: integer("max_zoom").notNull().default(18),
  subdomains: text("subdomains"),
  description: text("description"),
});

export const insertBasemapSchema = createInsertSchema(basemaps).omit({
  id: true,
});

export type InsertBasemap = z.infer<typeof insertBasemapSchema>;
export type Basemap = typeof basemaps.$inferSelect;

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
});

export const insertAppSettingSchema = createInsertSchema(appSettings);

export type InsertAppSetting = z.infer<typeof insertAppSettingSchema>;
export type AppSetting = typeof appSettings.$inferSelect;

export const administrativeBoundaries = pgTable("administrative_boundaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull(),
  level: text("level").notNull(),
  parentCode: text("parent_code"),
  geometry: jsonb("geometry").notNull(),
  properties: jsonb("properties").notNull().default({}),
  minLng: real("min_lng"),
  minLat: real("min_lat"),
  maxLng: real("max_lng"),
  maxLat: real("max_lat"),
  centerLng: real("center_lng"),
  centerLat: real("center_lat"),
}, (table) => [
  index("idx_admin_boundaries_level").on(table.level),
  uniqueIndex("uq_admin_boundaries_code").on(table.code),
]);

export const insertAdminBoundarySchema = createInsertSchema(administrativeBoundaries).omit({
  id: true,
});

export type InsertAdminBoundary = z.infer<typeof insertAdminBoundarySchema>;
export type AdminBoundary = typeof administrativeBoundaries.$inferSelect;

export const boundaryAggregateCache = pgTable("boundary_aggregate_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  layerId: varchar("layer_id").notNull(),
  level: text("level").notNull(),
  boundaryId: varchar("boundary_id").notNull(),
  boundaryName: text("boundary_name").notNull(),
  boundaryCode: text("boundary_code").notNull(),
  count: integer("count").notNull().default(0),
  centerLng: real("center_lng").notNull(),
  centerLat: real("center_lat").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_boundary_cache_layer_level").on(table.layerId, table.level),
  uniqueIndex("uq_boundary_cache_layer_level_boundary").on(table.layerId, table.level, table.boundaryId),
  foreignKey({ columns: [table.layerId], foreignColumns: [layers.id] }).onDelete("cascade"),
  foreignKey({ columns: [table.boundaryId], foreignColumns: [administrativeBoundaries.id] }).onDelete("cascade"),
]);

export type BoundaryAggregateCache = typeof boundaryAggregateCache.$inferSelect;

// 격자 집계 캐시 — z16~17 응답 속도 개선용
export const gridAggregateCache = pgTable("grid_aggregate_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  layerId: varchar("layer_id").notNull(),
  cellSize: real("cell_size").notNull(),    // 격자 크기(도 단위, 예: 0.0027)
  gx: integer("gx").notNull(),              // 격자 X 인덱스
  gy: integer("gy").notNull(),              // 격자 Y 인덱스
  lng: real("lng").notNull(),               // 격자 내 점들의 평균 경도
  lat: real("lat").notNull(),               // 격자 내 점들의 평균 위도
  count: integer("count").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_grid_cache_layer_cell").on(table.layerId, table.cellSize),
  uniqueIndex("uq_grid_cache_layer_cell_gx_gy").on(table.layerId, table.cellSize, table.gx, table.gy),
  foreignKey({ columns: [table.layerId], foreignColumns: [layers.id] }).onDelete("cascade"),
]);

export type GridAggregateCache = typeof gridAggregateCache.$inferSelect;

export const spatialQueries = pgTable("spatial_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  queryType: text("query_type").notNull(),
  parameters: jsonb("parameters").notNull(),
  resultCount: integer("result_count"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSpatialQuerySchema = createInsertSchema(spatialQueries).omit({
  id: true,
  resultCount: true,
  createdAt: true,
});

export type InsertSpatialQuery = z.infer<typeof insertSpatialQuerySchema>;
export type SpatialQuery = typeof spatialQueries.$inferSelect;
