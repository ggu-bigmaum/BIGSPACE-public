### Large Dataset Rendering 전략 (100만 \~ 1000만 포인트/피처 대응)

목적 - 대용량 공간 데이터를 "끊김 없이" 렌더링 - 서버/DB/클라이언트
병목을 구조적으로 제거 - Layer Metadata / Feature API / Vector Tile /
SRID / Spatial Query Engine과 자연스럽게 결합

------------------------------------------------------------------------

### 1. 대용량 GIS가 느려지는 대표 원인

-   GeoJSON이 너무 큼
    -   전송 용량 폭증
    -   파싱/렌더링 CPU 폭증
-   지도 이동/줌마다 전체 재조회
-   인덱스/쿼리 최적화 부재
-   클라이언트 렌더링이 Canvas 2D 기반
-   서버에서 "원본 그대로" 내려줌 (요약/집계/단순화 없음)

결론 - 100만 건 이상은 "피처 API + GeoJSON"만으로 버티기 어렵고, - 줌
단계에 따라 "집계 → 단순화 → 타일"로 계층화해야 함

------------------------------------------------------------------------

### 2. 핵심 원칙 (한 줄 요약)

-   저줌(멀리 보기): 집계/타일(벡터타일)로 "요약해서" 보여줌
-   고줌(가까이 보기): 필요한 범위(BBOX)만 "정밀하게" 보여줌
-   다운로드/분석: 별도 비동기 작업으로 분리 (UI 실시간과 분리)

------------------------------------------------------------------------

### 3. Zoom 기반 3단 렌더링 모델 (추천)

Level 1: 저줌 (Z 0\~10) - 목적: 전체 분포/밀도 파악 - 방식 - Vector Tile
(MVT) 또는 Raster Tile - Grid 집계(heatmap / cluster) - 내려주는
데이터 - 포인트 원본이 아니라 "집계 결과"

Level 2: 중줌 (Z 11\~14) - 목적: 대략적 위치/패턴 + 일부 상세 - 방식 -
Vector Tile (MVT) - Simplified geometry - Supercluster 등 클러스터링

Level 3: 고줌 (Z 15+) - 목적: 개별 피처 확인 - 방식 - Feature API
(BBOX + LIMIT + 필터) - 또는 고줌 전용 MVT - 내려주는 데이터 - 해당 화면
범위의 필요한 피처만

------------------------------------------------------------------------

### 4. 서버 전략: Vector Tile (MVT) 우선

대용량은 기본적으로 MVT로 분기

Vector Tile API

GET /api/tiles/:layer/{z}/{x}/{y}.mvt

PostGIS MVT 생성 예시 (4326 저장, 3857 타일)

SELECT ST_AsMVT(tile, 'layer', 4096, 'geom') AS mvt FROM ( SELECT id,
ST_AsMVTGeom( ST_Transform(geom, 3857), ST_TileEnvelope(z, x, y), 4096,
64, true ) AS geom, name, status FROM facility_layer WHERE
ST_Transform(geom, 3857) && ST_TileEnvelope(z, x, y) ) AS tile;

핵심 포인트 - DB는 4326 유지 - 타일 생성 시만 3857로 변환 -
ST_AsMVTGeom에서 clip/buffer 활용 - 타일 범위(BBOX)로 먼저 필터링

------------------------------------------------------------------------

### 5. 서버 전략: GeoJSON Feature API는 "고줌 전용"으로 제한

Feature API 예시

GET /api/layers/:id/features?bbox=xmin,ymin,xmax,ymax&limit=2000

권장 정책 - 반드시 bbox 파라미터 요구 (전체 조회 금지) - limit 기본값
강제 - zoom 파라미터로 단계별 제한 - 결과가 많으면 "타일/집계 모드로
전환" 안내

BBOX + LIMIT SQL 예시

SELECT \* FROM facility_layer WHERE geom && ST_MakeEnvelope(xmin, ymin,
xmax, ymax, 4326) LIMIT 2000;

------------------------------------------------------------------------

### 6. 집계(Aggregation) 전략: 저줌에서는 "원본을 보여주지 않음"

1)  Grid 집계 (추천: DB에서 수행)

-   화면 범위를 grid로 나눠 count 집계
-   결과는 centroid + count 형태로 전달

예: 4326 저장 기준, geography/grid 방식은 구현 선택

2)  Cluster 집계 (추천: 타일 또는 서버)

-   Supercluster(서버/클라이언트) 사용 가능
-   다만 1000만 단위에서는 서버/타일 기반이 더 안정적

------------------------------------------------------------------------

### 7. Geometry 단순화(Simplification) 전략

Polygon/Line이 무거울 때 필수

-   줌별 단순화 테이블 준비
-   또는 쿼리 시 ST_Simplify 적용 (고부하 가능성)

권장: "줌별 단순화 컬럼/뷰"

예시 - geom_z10 (거칠게) - geom_z14 (중간) - geom (원본)

또는 Materialized View로 미리 생성

------------------------------------------------------------------------

### 8. DB 전략: 인덱스 + 파티셔닝 + 통계

1)  공간 인덱스 (필수)

CREATE INDEX idx_facility_geom ON facility_layer USING GIST (geom);

2)  시간 파티셔닝 (이벤트/민원/VOC 같은 테이블에 매우 효과적)

-   월별/분기별 파티션
-   최근 데이터만 자주 조회할 때 성능 급상승

3)  분석용 집계 테이블

-   "줌별/그리드별 count"를 미리 계산해두면 저줌이 매우 빨라짐

------------------------------------------------------------------------

### 9. 캐시 전략

1)  Tile Cache (가장 효과 큼)

-   동일 타일 재요청이 매우 많음
-   CDN 또는 Reverse Proxy로 캐시 가능

2)  Query Cache

-   bbox + zoom + filter 조합을 키로 캐시
-   단, 갱신 정책 필요

------------------------------------------------------------------------

### 10. 클라이언트(OpenLayers) 렌더링 전략

1)  VectorTile 레이어 사용

-   OpenLayers VectorTile + MVT 포맷

2)  스타일은 클라이언트에서 적용

-   MVT의 장점: 속성 기반 스타일을 프론트에서 빠르게

3)  고줌에서만 Vector/GeoJSON 레이어 활성화

-   줌 이벤트로 레이어 전환

예시 전략 - 줌 \< 15: VectorTile ON, FeatureLayer OFF - 줌 \>= 15:
VectorTile ON 또는 OFF (선택), FeatureLayer ON

4)  WebGL 렌더러 고려

-   포인트가 많으면 Canvas보다 WebGL이 유리
-   OpenLayers WebGLPoints 등 활용 가능

------------------------------------------------------------------------

### 11. "대용량 대응"을 Layer Metadata에 녹이는 방법 (매우 중요)

Layer Metadata에 성능 정책을 포함

예시 필드(권장)

-   render_mode
    -   auto \| feature \| tile \| aggregate
-   feature_limit
    -   2000
-   min_zoom_for_features
    -   15
-   tile_enabled
    -   true/false
-   tile_max_zoom
    -   14
-   simplify_levels
    -   \[10, 14\] 등

이렇게 하면 "레이어 추가"만으로 성능 정책까지 같이 적용됨

------------------------------------------------------------------------

### 12. 실전 권장 세팅 (초기 MVP 기준)

포인트 100만 \~ 1000만

-   기본: Vector Tile (z 0\~14)
-   상세: Feature API (z 15+), bbox 필수, limit 2000
-   필터/검색
    -   고줌에서만 세밀 필터
    -   저줌에서는 집계 결과만

폴리곤/라인 대용량

-   줌별 단순화(MV 또는 컬럼)
-   타일 기반 렌더링 우선
-   필요 시 고줌에서만 원본

------------------------------------------------------------------------

### 13. 체크리스트 (대용량 성능 이슈 방지용)

-   DB
    -   GIST 인덱스 있음
    -   ANALYZE 최신
    -   필요 시 파티셔닝
-   API
    -   bbox 강제
    -   limit 강제
    -   zoom 기반 응답 전략 있음
-   Tile
    -   MVT API 존재
    -   타일 캐시 존재
-   Front
    -   줌 기반 레이어 전환
    -   VectorTile 사용
    -   (선택) WebGL

------------------------------------------------------------------------

### 14. 최종 구조 정리

Layer Metadata ↓ Feature API (고줌) ↓ Spatial Query Engine
(반경/영역/최근접 등) ↓ Vector Tile Engine (저/중줌 + 대용량) ↓ Caching
(Tile/Query) ↓ OpenLayers Viewer (줌 기반 레이어 전환)
