CREATE TABLE "administrative_boundaries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"level" text NOT NULL,
	"parent_code" text,
	"geometry" jsonb NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"min_lng" real,
	"min_lat" real,
	"max_lng" real,
	"max_lat" real,
	"center_lng" real,
	"center_lat" real
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"username" text,
	"action" text NOT NULL,
	"resource" text,
	"resource_id" varchar,
	"ip" text NOT NULL,
	"user_agent" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "basemaps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"url_template" text NOT NULL,
	"api_key" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"attribution" text,
	"max_zoom" integer DEFAULT 18 NOT NULL,
	"subdomains" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "boundary_aggregate_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"layer_id" varchar NOT NULL,
	"level" text NOT NULL,
	"boundary_id" varchar NOT NULL,
	"boundary_name" text NOT NULL,
	"boundary_code" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"center_lng" real NOT NULL,
	"center_lat" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "features" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"layer_id" varchar NOT NULL,
	"geometry" jsonb NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lng" real,
	"lat" real,
	"min_lng" real,
	"min_lat" real,
	"max_lng" real,
	"max_lat" real
);
--> statement-breakpoint
CREATE TABLE "grid_aggregate_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"layer_id" varchar NOT NULL,
	"cell_size" real NOT NULL,
	"gx" integer NOT NULL,
	"gy" integer NOT NULL,
	"lng" real NOT NULL,
	"lat" real NOT NULL,
	"count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "layers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT '일반' NOT NULL,
	"sub_category" text,
	"geometry_type" text DEFAULT 'Point' NOT NULL,
	"srid" integer DEFAULT 4326 NOT NULL,
	"render_mode" text DEFAULT 'auto' NOT NULL,
	"feature_limit" integer DEFAULT 5000 NOT NULL,
	"min_zoom_for_features" integer DEFAULT 17 NOT NULL,
	"min_zoom_for_clusters" integer DEFAULT 7 NOT NULL,
	"tile_enabled" boolean DEFAULT true NOT NULL,
	"tile_max_zoom" integer DEFAULT 14 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"opacity" real DEFAULT 1 NOT NULL,
	"stroke_color" text DEFAULT '#0d9488' NOT NULL,
	"fill_color" text DEFAULT '#0d948850' NOT NULL,
	"stroke_width" real DEFAULT 2 NOT NULL,
	"point_radius" real DEFAULT 6 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"feature_count" integer DEFAULT 0 NOT NULL,
	"bounds" jsonb,
	"wms_url" text,
	"wms_layers" text,
	"wfs_url" text,
	"wfs_layers" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spatial_queries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"query_type" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"result_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boundary_aggregate_cache" ADD CONSTRAINT "boundary_aggregate_cache_layer_id_layers_id_fk" FOREIGN KEY ("layer_id") REFERENCES "public"."layers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boundary_aggregate_cache" ADD CONSTRAINT "boundary_aggregate_cache_boundary_id_administrative_boundaries_id_fk" FOREIGN KEY ("boundary_id") REFERENCES "public"."administrative_boundaries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_layer_id_layers_id_fk" FOREIGN KEY ("layer_id") REFERENCES "public"."layers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_aggregate_cache" ADD CONSTRAINT "grid_aggregate_cache_layer_id_layers_id_fk" FOREIGN KEY ("layer_id") REFERENCES "public"."layers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_boundaries_level" ON "administrative_boundaries" USING btree ("level");--> statement-breakpoint
CREATE INDEX "idx_admin_boundaries_code" ON "administrative_boundaries" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_boundary_cache_layer_level" ON "boundary_aggregate_cache" USING btree ("layer_id","level");--> statement-breakpoint
CREATE INDEX "idx_features_layer_id" ON "features" USING btree ("layer_id");--> statement-breakpoint
CREATE INDEX "idx_features_layer_lng_lat" ON "features" USING btree ("layer_id","lng","lat");--> statement-breakpoint
CREATE INDEX "idx_grid_cache_layer_cell" ON "grid_aggregate_cache" USING btree ("layer_id","cell_size");--> statement-breakpoint
CREATE INDEX "idx_grid_cache_coords" ON "grid_aggregate_cache" USING btree ("layer_id","cell_size","gx","gy");