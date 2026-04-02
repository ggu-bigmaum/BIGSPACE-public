# MVT (Mapbox Vector Tile) 벡터 타일 설계서

**작성일:** 2026-03-26
**프로젝트:** BIGSPACE GIS 플랫폼
**목적:** 대용량 폴리곤 데이터(100m x 100m 격자 등)의 고속 렌더링

---

## 1. 배경

### 현재 방식 (GeoJSON bbox 로딩)
```
지도 이동 → fetch("/api/layers/:id/features?bbox=...")
→ 서버가 GeoJSON 전체 반환 (좌표 전부 텍스트)
→ 브라우저가 파싱 + 렌더링
```
- 응답 크기 큼 (JSON 텍스트)
- 줌 레벨과 무관하게 원본 좌표 전부 전송
- 타일 캐시 불가

### 변경 방식 (MVT 벡터 타일)
```
지도 이동 → fetch("/tiles/:z/:x/:y.pbf")
→ PostGIS가 해당 타일만 추출 + 줌에 맞게 단순화 + 바이너리 압축
→ 브라우저가 바로 렌더링
```
- 응답 크기 GeoJSON의 1/5 ~ 1/10 (protobuf 바이너리)
- 줌 낮으면 꼭짓점 자동 축소
- 타일 단위 캐시 가능

---

## 2. 방식 비교

| 방식 | 첫 요청 | 캐시 후 | 추가 디스크 | 인터랙션 |
|------|---------|---------|------------|----------|
| 래스터 타일 (이미지) | 즉시 | 즉시 | ~1TB | 불가 |
| **MVT (벡터 타일)** | 50~200ms | 10ms | **0** | **클릭/호버/스타일 변경 자유** |
| GeoJSON (현재) | 200~2000ms | 없음 | 0 | 가능 |

### MVT 선택 이유
- 래스터 타일 대비: 디스크 0, 인터랙션 자유
- GeoJSON 대비: 전송 속도 5~10배, 타일 캐시 가능
- 추가 디스크 없이 DB(PostGIS)에서 실시간 생성

---

## 3. 아키텍처

```
┌─────────────────────────────────────────────────┐
│  브라우저 (OpenLayers)                            │
│  VectorTileLayer + VectorTileSource + MVT format │
│  → 폴리곤 클릭, 호버, 스타일 변경 가능            │
└──────────────────┬──────────────────────────────┘
                   │ GET /api/layers/:id/tiles/:z/:x/:y.pbf
                   ▼
┌─────────────────────────────────────────────────┐
│  Express 서버                                     │
│  → z/x/y로 타일 영역 계산 (ST_TileEnvelope)       │
│  → 해당 영역 features 추출                        │
│  → ST_AsMVTGeom() + ST_AsMVT() 변환              │
│  → pbf 바이너리 응답                              │
└──────────────────┬──────────────────────────────┘
                   │ SQL
                   ▼
┌─────────────────────────────────────────────────┐
│  PostGIS (DB 50GB)                               │
│  features 테이블 + GIST 인덱스                    │
│  → ST_TileEnvelope로 영역 필터                    │
│  → ST_Simplify로 줌별 단순화                      │
│  → ST_AsMVT로 protobuf 변환                      │
└─────────────────────────────────────────────────┘
```

---

## 4. 서버 API

### 엔드포인트
```
GET /api/layers/:id/tiles/:z/:x/:y.pbf
```

### 처리 흐름
1. `z`, `x`, `y` 파라미터로 타일 영역 계산 (`ST_TileEnvelope(z, x, y, 3857)`)
2. 해당 영역과 교차하는 features 조회 (`ST_Intersects`)
3. 줌 레벨에 따라 geometry 단순화 (`ST_Simplify`)
4. `ST_AsMVTGeom()` + `ST_AsMVT()`로 MVT 바이너리 생성
5. 속성값(공시지가, 면적 등) 포함
6. 응답 헤더: `Content-Type: application/vnd.mapbox-vector-tile`

### PostGIS 쿼리 예시
```sql
WITH tile AS (
  SELECT ST_TileEnvelope($1, $2, $3) AS envelope
),
mvt_data AS (
  SELECT
    ST_AsMVTGeom(
      f.geom,
      tile.envelope,
      4096,  -- extent (해상도)
      256,   -- buffer
      true   -- clip
    ) AS geom,
    f.id,
    f.properties->>'value' AS value
  FROM features f, tile
  WHERE f.layer_id = $4
    AND ST_Intersects(f.geom, ST_Transform(tile.envelope, 4326))
)
SELECT ST_AsMVT(mvt_data, 'layer') AS tile
FROM mvt_data;
```

---

## 5. 클라이언트 (OpenLayers)

### 변경 사항
- 기존: `VectorLayer` + `VectorSource` + GeoJSON fetch
- 변경: `VectorTileLayer` + `VectorTileSource` + `MVT` format

### 코드 구조
```typescript
import MVT from "ol/format/MVT";
import VectorTileLayer from "ol/layer/VectorTile";
import VectorTileSource from "ol/source/VectorTile";

const source = new VectorTileSource({
  format: new MVT(),
  url: `/api/layers/${layer.id}/tiles/{z}/{x}/{y}.pbf`,
});

const vtLayer = new VectorTileLayer({
  source,
  style: getLayerStyle(layer),  // 기존 스타일 함수 재활용
});
```

### 인터랙션
- 폴리곤 클릭 → 속성 정보 팝업 (기존 로직 유지)
- 마우스 호버 → 하이라이트 가능
- 스타일 실시간 변경 가능

---

## 6. 적용 범위

### MVT 적용 대상
- `geometryType`이 Polygon/MultiPolygon인 레이어
- featureCount가 큰 레이어 (격자 데이터 등)
- 레이어별 개별 타일 (레이어 합치지 않음)

### 변경 없음 (기존 방식 유지)
- Point 레이어 → 줌별 집계 (시도/시군구/읍면동 → 격자 → 개별)
- WMS/WFS 외부 레이어 → 기존 프록시 방식
- 소규모 레이어 (featureCount < 1000) → GeoJSON 직접 로딩

---

## 7. 캐시 전략

### 1단계 (초기): 캐시 없음
- PostGIS 실시간 생성으로 시작
- GIST 인덱스로 충분히 빠름 (50~200ms)

### 2단계 (필요 시): HTTP 캐시
- 응답 헤더: `Cache-Control: public, max-age=3600`
- 브라우저가 같은 타일 재요청 안 함

### 3단계 (필요 시): 서버 캐시
- Redis 또는 파일 캐시로 타일 저장
- 데이터 변경 시 해당 레이어 캐시 무효화
- 자주 요청되는 타일 10ms 이내 응답

---

## 8. 레이어 운영 가이드

- 동시에 켜는 레이어: **20개 이하 권장**
- 레이어 on/off는 개별 제어
- 400개 레이어 전부 동시 활성화 금지 (HTTP 요청 폭발)
- 레이어 그룹핑은 UI 메뉴로 관리 (타일 합치기 아님)
