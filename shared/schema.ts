import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const layers = pgTable("layers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  geometryType: text("geometry_type").notNull().default("Point"),
  srid: integer("srid").notNull().default(4326),
  renderMode: text("render_mode").notNull().default("auto"),
  featureLimit: integer("feature_limit").notNull().default(2000),
  minZoomForFeatures: integer("min_zoom_for_features").notNull().default(15),
  tileEnabled: boolean("tile_enabled").notNull().default(true),
  tileMaxZoom: integer("tile_max_zoom").notNull().default(14),
  visible: boolean("visible").notNull().default(true),
  opacity: real("opacity").notNull().default(1),
  strokeColor: text("stroke_color").notNull().default("#3b82f6"),
  fillColor: text("fill_color").notNull().default("#3b82f680"),
  strokeWidth: real("stroke_width").notNull().default(2),
  pointRadius: real("point_radius").notNull().default(6),
  featureCount: integer("feature_count").notNull().default(0),
  bounds: jsonb("bounds"),
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
});

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
