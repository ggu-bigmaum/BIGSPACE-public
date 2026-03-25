# BIGSPACE - GIS 지도 플랫폼

## 핵심 파일 (이것만 읽으면 됨)

| 파일 | 역할 |
|------|------|
| `shared/schema.ts` | DB 테이블 정의 (layers, features, administrative_boundaries 등 8개) |
| `server/routes.ts` | 전체 API 엔드포인트 |
| `server/storage.ts` | DB 쿼리 로직 (PIP, 격자집계, 캐시 등) |
| `server/seed.ts` | 서버 시작 시 자동 seeding (basemaps, settings, 레이어 메타데이터) |
| `client/src/components/map-viewer.tsx` | 지도 렌더링 (OpenLayers) |
| `client/src/pages/settings-page.tsx` | 설정 UI (행정경계 업로드 포함) |

## DB 접속

```
postgresql://postgres:0000@localhost:5432/Test
```
스키마: public

## 실행

```bash
npm run dev   # cross-env로 설정됨 (Windows 대응)
```

## 기술 스택

- **Frontend**: React + OpenLayers (지도)
- **Backend**: Express + TypeScript (tsx)
- **DB**: PostgreSQL + Drizzle ORM
- **좌표계 변환**: proj4 (EPSG:5181 → 4326)

## 데이터 현황

- `응급출동 현황 2020`: features 테이블에 477,724건 (EPSG:5181 변환 완료)
- `응급출동 현황 2021/2022`: 레이어 메타만 있음, features 미삽입
- `administrative_boundaries`: 시도(17) / 시군구(252) / 읍면동(3558) 업로드 완료
- `boundary_aggregate_cache`: 시도/시군구 캐시 완료, 읍면동 빌드 중

## 렌더링 단계 (줌 레벨별)

낮음 → 행정경계 집계(시도/시군구/읍면동) → 격자(grid) 집계 → 개별 피처 점

## 주요 API

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/layers` | 레이어 목록 |
| `GET /api/layers/:id/features` | 피처 조회 (bbox, zoom 파라미터) |
| `GET /api/layers/:id/aggregate` | 격자 집계 |
| `GET /api/layers/:id/boundary-aggregate` | 행정경계 집계 |
| `POST /api/admin-boundaries/upload` | SHP/ZIP 업로드 (최대 1GB) |
| `POST /api/admin/build-boundary-cache` | 캐시 빌드 (x-migrate-token 필요) |

## 임포트 스크립트

- `scripts/import-emergency-2020.mjs`: 응급출동 CSV → features 변환 (EPSG:5181 기준)
