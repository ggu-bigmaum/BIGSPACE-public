# MVT 벡터 타일 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대용량 폴리곤 레이어를 PostGIS ST_AsMVT()로 실시간 벡터 타일 서빙하여 기존 GeoJSON 방식 대비 5~10배 빠른 렌더링 구현

**Architecture:** 서버에 `/api/layers/:id/tiles/:z/:x/:y.pbf` 엔드포인트 추가. PostGIS가 타일 영역 추출 + 줌별 단순화 + protobuf 변환을 수행. 클라이언트는 OpenLayers VectorTileLayer로 렌더링. Polygon/MultiPolygon 레이어에만 적용하고, Point 레이어와 WMS/WFS는 기존 방식 유지.

**Tech Stack:** PostGIS 3.1+ (ST_AsMVT, ST_TileEnvelope), OpenLayers 10.8 (ol/format/MVT, VectorTileLayer), Express

---

## 파일 구조

| 파일 | 역할 | 작업 |
|------|------|------|
| `server/routes.ts` | MVT 타일 엔드포인트 추가 | 수정 |
| `server/storage.ts` | `getMvtTile()` 함수 추가 | 수정 |
| `client/src/hooks/useLayerRenderer.ts` | VectorTileLayer 렌더링 분기 추가 | 수정 |
| `client/src/lib/mapStyles.ts` | VectorTile용 스타일 함수 추가 | 수정 |
| `client/src/hooks/useMapInit.ts` | VectorTile 피처 클릭 인터랙션 | 수정 |

---

### Task 1: PostGIS MVT 함수 지원 확인

**Files:**
- Check: PostgreSQL/PostGIS 버전

- [ ] **Step 1: PostGIS 버전 확인**

```bash
cd "C:\Users\admin\Desktop\빅마음\03_Dev\02_Web\BIGSPACE-public"
node -e "
const {Pool} = require('pg');
const p = new Pool({connectionString: process.env.DATABASE_URL || 'postgresql://postgres:0000@localhost:5432/Test'});
p.query('SELECT PostGIS_Full_Version()').then(r => {
  console.log(r.rows[0].postgis_full_version);
  p.end();
});
"
```

Expected: PostGIS 3.1 이상이면 `ST_TileEnvelope`, `ST_AsMVT`, `ST_AsMVTGeom` 모두 사용 가능.

- [ ] **Step 2: ST_AsMVT 함수 테스트**

```bash
node -e "
const {Pool} = require('pg');
const p = new Pool({connectionString: process.env.DATABASE_URL || 'postgresql://postgres:0000@localhost:5432/Test'});
p.query(\`
  WITH tile AS (
    SELECT ST_TileEnvelope(11, 1745, 791) AS envelope
  ),
  mvtdata AS (
    SELECT ST_AsMVTGeom(
      ST_Transform(f.geom, 3857),
      tile.envelope,
      4096, 64, true
    ) AS geom,
    f.id
    FROM features f, tile
    WHERE f.geom IS NOT NULL
      AND ST_Intersects(f.geom, ST_Transform(tile.envelope, 4326))
    LIMIT 10
  )
  SELECT length(ST_AsMVT(mvtdata, 'layer')) AS tile_bytes
  FROM mvtdata
\`).then(r => {
  console.log('MVT tile bytes:', r.rows[0]?.tile_bytes || 'NO DATA');
  p.end();
}).catch(e => { console.error('ERROR:', e.message); p.end(); });
"
```

Expected: `MVT tile bytes: <숫자>` 출력. 에러 발생 시 PostGIS 업그레이드 필요.

- [ ] **Step 3: 커밋 없음 (확인 작업만)**

---

### Task 2: 서버 — getMvtTile() 스토리지 함수 추가

**Files:**
- Modify: `server/storage.ts` (getMvtTile 함수 추가)

- [ ] **Step 1: storage.ts에 getMvtTile 함수 추가**

`server/storage.ts` 파일의 마지막 메서드 뒤, 클래스 닫기 전에 추가:

```typescript
async getMvtTile(layerId: string, z: number, x: number, y: number): Promise<Buffer | null> {
  const result = await db.execute(sql`
    WITH tile_env AS (
      SELECT ST_TileEnvelope(${z}, ${x}, ${y}) AS envelope
    ),
    mvtgeom AS (
      SELECT
        ST_AsMVTGeom(
          ST_Transform(f.geom, 3857),
          tile_env.envelope,
          4096,
          64,
          true
        ) AS geom,
        f.id,
        f.properties
      FROM features f, tile_env
      WHERE f.layer_id = ${layerId}
        AND f.geom IS NOT NULL
        AND ST_Intersects(
          f.geom,
          ST_Transform(tile_env.envelope, 4326)
        )
      LIMIT 50000
    )
    SELECT ST_AsMVT(mvtgeom, 'default', 4096, 'geom') AS tile
    FROM mvtgeom
  `);

  const row = result.rows[0] as any;
  if (!row?.tile) return null;
  return Buffer.from(row.tile);
}
```

- [ ] **Step 2: 함수 동작 확인**

```bash
node -e "
require('dotenv').config();
const {Pool} = require('pg');
const p = new Pool({connectionString: process.env.DATABASE_URL});
// 서울 영역 z=11 타일
p.query(\`
  WITH tile_env AS (
    SELECT ST_TileEnvelope(11, 1745, 791) AS envelope
  ),
  mvtgeom AS (
    SELECT
      ST_AsMVTGeom(ST_Transform(f.geom, 3857), tile_env.envelope, 4096, 64, true) AS geom,
      f.id, f.properties
    FROM features f, tile_env
    WHERE f.layer_id = (SELECT id FROM layers LIMIT 1)
      AND f.geom IS NOT NULL
      AND ST_Intersects(f.geom, ST_Transform(tile_env.envelope, 4326))
    LIMIT 50000
  )
  SELECT length(ST_AsMVT(mvtgeom, 'default', 4096, 'geom')) AS bytes
  FROM mvtgeom
\`).then(r => {
  console.log('Tile size:', r.rows[0]?.bytes, 'bytes');
  p.end();
}).catch(e => { console.error(e.message); p.end(); });
"
```

Expected: `Tile size: <숫자> bytes` 출력

- [ ] **Step 3: 커밋**

```bash
git add server/storage.ts
git commit -m "feat: add getMvtTile() for PostGIS vector tile generation"
```

---

### Task 3: 서버 — MVT 타일 API 엔드포인트

**Files:**
- Modify: `server/routes.ts` (타일 엔드포인트 추가)

- [ ] **Step 1: routes.ts에 MVT 타일 엔드포인트 추가**

`routes.ts`의 `/api/layers/:id/features` 엔드포인트(약 line 235) 뒤에 추가:

```typescript
// ── MVT 벡터 타일 ──────────────────────────────────────────────────
app.get("/api/layers/:id/tiles/:z/:x/:y.pbf", async (req, res) => {
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
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (!tile || tile.length === 0) {
      return res.status(204).send();
    }

    res.send(tile);
  } catch (err) {
    console.error("MVT tile error:", err);
    res.status(500).send("Tile generation failed");
  }
});
```

주의: 이 엔드포인트에는 `requireAuth`를 붙이지 않음. 타일은 맵 렌더링에 필수이고, WMS/WFS 프록시와 동일하게 공개 접근 허용. 인증이 필요하면 나중에 추가.

- [ ] **Step 2: curl로 엔드포인트 테스트**

```bash
# 서버 실행 중인 상태에서
curl -s -o /dev/null -w "Status: %{http_code}, Size: %{size_download} bytes\n" \
  "http://localhost:5000/api/layers/$(node -e "
    require('dotenv').config();
    const {Pool}=require('pg');
    const p=new Pool({connectionString:process.env.DATABASE_URL});
    p.query('SELECT id FROM layers LIMIT 1').then(r=>{console.log(r.rows[0].id);p.end()});
  ")/tiles/11/1745/791.pbf"
```

Expected: `Status: 200, Size: <숫자> bytes` 또는 `Status: 204` (데이터 없는 영역)

- [ ] **Step 3: 커밋**

```bash
git add server/routes.ts
git commit -m "feat: add MVT tile endpoint /api/layers/:id/tiles/:z/:x/:y.pbf"
```

---

### Task 4: 클라이언트 — VectorTileLayer 스타일 함수

**Files:**
- Modify: `client/src/lib/mapStyles.ts` (getMvtStyle 함수 추가)

- [ ] **Step 1: mapStyles.ts에 MVT용 스타일 함수 추가**

파일 맨 아래에 추가:

```typescript
export function getMvtStyle(layer: Layer) {
  const gtype = layer.geometryType?.toLowerCase() || "";
  const isPoint = gtype.includes("point");
  const isLine = gtype.includes("line");

  return new Style({
    ...(!isPoint && !isLine && { fill: new Fill({ color: layer.fillColor }) }),
    stroke: new Stroke({ color: layer.strokeColor, width: layer.strokeWidth }),
    ...(isPoint && {
      image: new CircleStyle({
        radius: layer.pointRadius,
        fill: new Fill({ color: layer.fillColor }),
        stroke: new Stroke({ color: layer.strokeColor, width: layer.strokeWidth }),
      }),
    }),
  });
}
```

- [ ] **Step 2: 커밋**

```bash
git add client/src/lib/mapStyles.ts
git commit -m "feat: add getMvtStyle() for vector tile layer styling"
```

---

### Task 5: 클라이언트 — useLayerRenderer에 MVT 렌더링 분기 추가

**Files:**
- Modify: `client/src/hooks/useLayerRenderer.ts`

- [ ] **Step 1: import 추가**

`useLayerRenderer.ts` 상단 import 영역에 추가:

```typescript
import VectorTileLayer from "ol/layer/VectorTile";
import VectorTileSource from "ol/source/VectorTile";
import MVT from "ol/format/MVT";
```

- [ ] **Step 2: mvtLayersRef 추가**

기존 ref 선언부 (line 22~27 근처)에 추가:

```typescript
const mvtLayersRef = useRef<Map<string, VectorTileLayer>>(new Map());
```

- [ ] **Step 3: MVT 레이어 판별 헬퍼 추가**

`getZoomTier` 뒤에 추가:

```typescript
const shouldUseMvt = useCallback((layer: Layer): boolean => {
  if (layer.wmsUrl || layer.wfsUrl) return false;
  const gtype = layer.geometryType?.toLowerCase() || "";
  return (gtype.includes("polygon") || gtype.includes("line")) && layer.featureCount > 1000;
}, []);
```

- [ ] **Step 4: useEffect 내 MVT 레이어 생성/업데이트 로직 추가**

useEffect (line 144 근처) 내부, WFS 처리 블록(line 159) **앞에** 추가:

```typescript
// ── MVT 벡터 타일 레이어 ──
layerList.forEach(layer => {
  if (!shouldUseMvt(layer)) return;
  const existingMvt = mvtLayersRef.current.get(layer.id);
  if (existingMvt) {
    existingMvt.setVisible(layer.visible);
    existingMvt.setOpacity(layer.opacity);
  } else if (layer.visible) {
    const mvtSource = new VectorTileSource({
      format: new MVT(),
      url: `/api/layers/${layer.id}/tiles/{z}/{x}/{y}.pbf`,
      maxZoom: 18,
    });
    const style = getLayerStyle(layer);
    const mvtLayer = new VectorTileLayer({
      source: mvtSource,
      style,
      zIndex: 10,
      opacity: layer.opacity,
    });
    mapInstance.current?.addLayer(mvtLayer);
    mvtLayersRef.current.set(layer.id, mvtLayer);
  }
});
```

- [ ] **Step 5: MVT 레이어 정리 로직 추가**

기존 레이어 정리 블록 (line 149~157 근처) 에 추가:

```typescript
mvtLayersRef.current.forEach((vl, id) => {
  if (!currentIds.has(id)) { mapInstance.current?.removeLayer(vl); mvtLayersRef.current.delete(id); }
});
```

- [ ] **Step 6: fetchAndRenderLayer에서 MVT 레이어 스킵**

`fetchAndRenderLayer` 함수 (line 42~43 근처)의 조건문을 수정:

기존:
```typescript
if (!mapInstance.current || layer.wmsUrl || layer.wfsUrl) return;
```

변경:
```typescript
if (!mapInstance.current || layer.wmsUrl || layer.wfsUrl || shouldUseMvt(layer)) return;
```

- [ ] **Step 7: 비가시 레이어 처리에서 MVT 스킵**

기존 비가시 레이어 처리 (line 235~243 근처):

기존:
```typescript
layerList.forEach(layer => {
  if (layer.wmsUrl) return;
```

변경:
```typescript
layerList.forEach(layer => {
  if (layer.wmsUrl || shouldUseMvt(layer)) return;
```

- [ ] **Step 8: 커밋**

```bash
git add client/src/hooks/useLayerRenderer.ts
git commit -m "feat: add MVT VectorTileLayer rendering for polygon layers"
```

---

### Task 6: 클라이언트 — VectorTile 피처 클릭 인터랙션

**Files:**
- Modify: `client/src/hooks/useMapInit.ts`

- [ ] **Step 1: 기존 클릭 핸들러에 VectorTile 지원 추가**

`useMapInit.ts`의 map click 핸들러 (약 line 128~146) 에서 `forEachFeatureAtPixel`은 VectorTileLayer도 자동 지원함. 단, VectorTile 피처의 properties 접근이 다름.

기존 클릭 핸들러의 `forEachFeatureAtPixel` 콜백 내부를 수정:

기존:
```typescript
const props = feature.getProperties();
delete props.geometry;
const name = props.name || props._id || "Feature";
```

변경:
```typescript
const props = { ...feature.getProperties() };
delete props.geometry;
// VectorTile 피처는 properties가 flat하게 들어옴
const name = props.name || props._id || props.id || "Feature";
```

- [ ] **Step 2: 커밋**

```bash
git add client/src/hooks/useMapInit.ts
git commit -m "feat: support VectorTile feature click in map interactions"
```

---

### Task 7: 통합 테스트 및 확인

**Files:**
- 없음 (동작 확인만)

- [ ] **Step 1: 서버 실행 및 MVT 엔드포인트 확인**

```bash
cd "C:\Users\admin\Desktop\빅마음\03_Dev\02_Web\BIGSPACE-public"
node -e "
require('dotenv').config();
const http = require('http');
const {Pool} = require('pg');
const p = new Pool({connectionString: process.env.DATABASE_URL});
p.query('SELECT id, name, geometry_type, feature_count FROM layers WHERE feature_count > 0 LIMIT 3')
  .then(r => {
    console.log('Layers:', r.rows);
    const layerId = r.rows[0]?.id;
    if (!layerId) { console.log('No layers'); p.end(); return; }
    // 서울 z=14 타일 테스트
    http.get('http://localhost:5000/api/layers/' + layerId + '/tiles/14/13961/6332.pbf', (res) => {
      let size = 0;
      res.on('data', c => size += c.length);
      res.on('end', () => {
        console.log('Tile status:', res.statusCode, 'Size:', size, 'bytes');
        console.log('Content-Type:', res.headers['content-type']);
        p.end();
      });
    });
  });
"
```

Expected:
```
Layers: [{ id: '...', name: '...', geometry_type: 'Point', feature_count: 477724 }]
Tile status: 200 Size: <숫자> bytes
Content-Type: application/vnd.mapbox-vector-tile
```

- [ ] **Step 2: 브라우저에서 확인**

1. `npm run dev`로 개발 서버 실행
2. 브라우저에서 지도 열기
3. Polygon 레이어 활성화
4. F12 → Network 탭에서 `.pbf` 요청이 보이는지 확인
5. 폴리곤이 지도에 렌더링되는지 확인
6. 폴리곤 클릭 시 속성 팝업이 뜨는지 확인

- [ ] **Step 3: 최종 커밋**

```bash
git add -A
git commit -m "feat: MVT vector tile implementation complete"
```

---

## 체크리스트

- [ ] PostGIS 3.1+ 확인 (ST_TileEnvelope 지원)
- [ ] getMvtTile() 스토리지 함수 동작
- [ ] /api/layers/:id/tiles/:z/:x/:y.pbf 엔드포인트 동작
- [ ] VectorTileLayer로 폴리곤 렌더링
- [ ] 폴리곤 클릭 → 속성 팝업
- [ ] 기존 Point 레이어 정상 동작 (영향 없음)
- [ ] 기존 WMS/WFS 레이어 정상 동작 (영향 없음)
