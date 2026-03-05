# GIS Solution - Spatial Data Platform

## Overview
Enterprise GIS solution (업무용 GIS 솔루션) for large-scale spatial data management, targeting Korean government procurement (조달청) registration. Built with React + Express + PostgreSQL (no PostGIS extension - uses application-level spatial operations). Dark navy/cyan theme with ESRI satellite basemap default.

## Architecture

### Frontend
- **React** with TypeScript
- **OpenLayers** for map rendering (VectorLayer, VectorSource, GeoJSON, XYZ tile sources)
- **Shadcn UI** components with Tailwind CSS
- **TanStack React Query** for data fetching
- **Dark theme default** with dark navy background (210 20% 6%) and cyan/teal accent (190 85% 50%)
- Zoom-based rendering: aggregate clusters at low zoom, individual features at high zoom
- Basemap management via Settings dialog (no basemap group in sidebar)
- Full-screen map with search overlay at top-center, zoom controls on right side
- Compact sidebar with toggle switches and type badges (VECTOR/RASTER/DEM/HEATMAP)

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
- `server/seed.ts` - Seed data (Seoul: 200 facilities, 30 roads, 5 admin zones, default basemaps including ESRI satellite, default settings)
- `client/src/App.tsx` - Main app layout: sidebar + full-screen map (no top header bar)
- `client/src/components/map-viewer.tsx` - OpenLayers map with search bar overlay, zoom controls, basemap switching, tile error detection
- `client/src/components/app-sidebar.tsx` - Redesigned sidebar: Korean title, workspace selector, layer toggles with type badges, export/settings footer
- `client/src/components/settings-dialog.tsx` - Settings dialog (basemap management, rendering settings, map settings)
- `client/src/components/add-layer-dialog.tsx` - New layer creation dialog
- `client/src/components/radius-search-panel.tsx` - Radius search tool
- `client/src/components/feature-info-panel.tsx` - Layer info panel
- `client/src/components/theme-provider.tsx` - Dark/light mode (defaults to dark)

## UI Design
- **Theme**: Dark navy (#0e1117) background, cyan/teal (#00c8dc) primary accent
- **Sidebar**: Dark sidebar with "GIS 업무 솔루션" title, active workspace selector, layer list with Switch toggles and type badges
- **Map**: Full-screen with ESRI satellite basemap default, search overlay at top-center, zoom +/- on right side
- **No top header**: Map fills full height alongside sidebar
- **Basemap providers**: ESRI satellite (default, no API key), OSM, VWorld (needs API key), Naver/Kakao (need SDK)

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
