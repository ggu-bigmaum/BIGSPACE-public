# GIS Solution - Spatial Data Platform

## Overview
Enterprise GIS solution for large-scale spatial data management following the Large Dataset Rendering Strategy document. Built with React + Express + PostgreSQL (no PostGIS extension - uses application-level spatial operations).

## Architecture

### Frontend
- **React** with TypeScript
- **OpenLayers** for map rendering (VectorLayer, VectorSource, GeoJSON, XYZ tile sources)
- **Shadcn UI** components with Tailwind CSS
- **TanStack React Query** for data fetching
- Zoom-based rendering: aggregate clusters at low zoom, individual features at high zoom
- Basemap switcher: supports OSM, VWorld, Naver, Kakao, custom XYZ tile sources

### Backend
- **Express.js** REST API
- **PostgreSQL** via Drizzle ORM
- Spatial operations via SQL (BBOX filtering, grid aggregation, radius search)
- Feature coordinates indexed via lat/lng columns for fast queries

### Data Model
- `layers` - Layer metadata with performance policies (render_mode, feature_limit, min_zoom_for_features, tile_enabled, etc.)
- `features` - Spatial features with GeoJSON geometry, indexed lat/lng/bbox columns
- `basemaps` - Basemap provider configurations (provider, URL template, API keys, enabled/default flags)
- `app_settings` - Application settings (key-value with categories: rendering, map)
- `spatial_queries` - Saved spatial query history

## Key Files
- `shared/schema.ts` - Drizzle schema definitions
- `server/routes.ts` - API endpoints (layers CRUD, features, aggregate, spatial queries, basemaps, settings)
- `server/storage.ts` - DatabaseStorage with spatial operations
- `server/seed.ts` - Seed data (Seoul: 200 facilities, 30 roads, 5 admin zones, default basemaps, default settings)
- `client/src/App.tsx` - Main app with sidebar + map layout + settings dialog
- `client/src/components/map-viewer.tsx` - OpenLayers map component with basemap switching
- `client/src/components/app-sidebar.tsx` - Layer management sidebar with basemap group and settings button
- `client/src/components/settings-dialog.tsx` - Settings dialog (basemap management, rendering settings, map settings)
- `client/src/components/add-layer-dialog.tsx` - New layer creation dialog
- `client/src/components/radius-search-panel.tsx` - Radius search tool
- `client/src/components/feature-info-panel.tsx` - Layer info panel
- `client/src/components/theme-provider.tsx` - Dark/light mode

## API Endpoints
- `GET /api/layers` - List all layers
- `POST /api/layers` - Create layer
- `PATCH /api/layers/:id` - Update layer
- `DELETE /api/layers/:id` - Delete layer
- `GET /api/layers/:id/features?bbox=&limit=&zoom=` - Get features (BBOX filtering)
- `POST /api/layers/:id/features` - Add features (single or batch)
- `GET /api/layers/:id/aggregate?bbox=&gridSize=` - Grid aggregation
- `GET /api/spatial/radius?lng=&lat=&radius=` - Radius search
- `GET /api/stats` - System statistics
- `GET /api/basemaps` - List basemap configurations
- `POST /api/basemaps` - Add basemap
- `PATCH /api/basemaps/:id` - Update basemap (API key, enabled, URL template)
- `DELETE /api/basemaps/:id` - Delete basemap
- `POST /api/basemaps/:id/default` - Set default basemap
- `GET /api/settings` - List all settings
- `GET /api/settings/:key` - Get single setting
- `PUT /api/settings/:key` - Update setting

## Performance Strategy (from MD document)
- Low zoom (Z0-12): Grid aggregation with cluster visualization
- Mid zoom (Z13-14): Simplified features with limits
- High zoom (Z15+): Full feature detail with BBOX filtering
- All feature queries enforce BBOX + LIMIT
- Layer metadata controls rendering behavior per-layer
- Debounced map move events (300ms configurable)

## Settings Categories
- **rendering**: defaultRenderMode, defaultFeatureLimit, defaultMinZoomForFeatures, aggregateGridSize, debounceMs
- **map**: defaultCenter, defaultZoom, maxZoom, minZoom
