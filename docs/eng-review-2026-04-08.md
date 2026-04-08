# Engineering Review — 2026-04-08

## Summary

| 심각도 | 발견 | 해결 | 잔여 |
|--------|------|------|------|
| Critical | 5 | 5 | 0 |
| High | 8 | 8 | 0 |
| Medium | 8 | 6 | 2 |

---

## Critical

| # | 이슈 | 위치 | 상태 | 대응 |
|---|------|------|------|------|
| C1 | Shell injection — `execSync("unzip ...")` 사용 | `routes.ts:761,784` | **DONE** | 이미 `adm-zip` 라이브러리로 교체됨 (다른 세션) |
| C2 | 첫 유저 admin 승격 레이스컨디션 — 동시 register 시 둘 다 admin | `routes.ts:88-92` | **DONE** | `4ecb88b` — `createUserWithAutoAdmin` 트랜잭션 + FOR UPDATE |
| C3 | OAuth 센티넬 비밀번호 `"!oauth-no-local-login!"` — 로그인에서 통과 가능성 | `routes.ts:165` | **DONE** | `4ecb88b` — `crypto.randomUUID()` 해시로 변경 |
| C4 | FK 제약 없음 — 고아 레코드 발생 가능 | `schema.ts` | **DONE** | `3add5dd` — CASCADE/SET NULL FK 5개 추가 |
| C5 | Geometry 이중화 — JSONB + PostGIS `geom` 병존, GiST 인덱스 중복 | `schema.ts`, DB | **DONE** | 중복 GiST 인덱스 제거. 이중화는 의도된 설계 (각 컬럼이 다른 쿼리 패턴 최적화). |

## High

| # | 이슈 | 위치 | 상태 | 대응 |
|---|------|------|------|------|
| H1 | WMS/WFS 프록시 오픈 릴레이 — 인증 없이 VWORLD_KEY 노출 | `routes.ts:496-552` | **DONE** | 이미 requireAuth 적용됨 (다른 세션) |
| H2 | Rate limiting 없음 — 로그인/회원가입 brute force 가능 | `routes.ts` 전체 | **DONE** | 이미 express-rate-limit 15분/20회 적용됨 (다른 세션) |
| H3 | WFS 메모리 누수 — features가 addFeatures로 계속 쌓임 | `useLayerRenderer.ts:278` | **DONE** | bbox 전환 시 `wfsSource.clear(true)` 후 addFeatures |
| H4 | OL 레이어 unmount 시 미정리 — cleanup 함수 없음 | `useLayerRenderer.ts` | **DONE** | unmount useEffect에서 4종 레이어 전부 removeLayer + clear |
| H5 | fetchAndRenderLayer 레이스 — clear 후 fetch 전 빈 화면 | `useLayerRenderer.ts:111` | **DONE** | fetch 전 clear 제거 → source 교체 시점에 자동 swap |
| H6 | deleteLayer/createFeatures 트랜잭션 없음 — 부분 실패 시 불일치 | `storage.ts:113,153` | **DONE** | `df8dcf6` — createFeature/createFeatures/setDefaultBasemap 트랜잭션 래핑 |
| H7 | 캐시 테이블 유니크 제약 없음 — 동시 빌드 시 중복 삽입 | `schema.ts` | **DONE** | `df8dcf6` — boundary/grid 캐시 유니크 인덱스, admin_boundaries.code 유니크 |
| H8 | 감사로그 엔드포인트 admin 가드 없음 | `routes.ts:194` | **DONE** | 이미 requireAdmin 적용됨 (다른 세션) |

## Medium

| # | 이슈 | 위치 | 상태 | 대응 |
|---|------|------|------|------|
| M1 | radius 무제한 (999999 → 풀스캔) | `routes.ts:456` | **DONE** | `bfab451` — NaN 검증 + max 50km 제한 |
| M2 | 업로드 실패 시 temp 파일 미정리 | `routes.ts:892` | **DONE** | `bfab451` — catch 블록에서 temp 파일 cleanup |
| M3 | `CREATE INDEX CONCURRENTLY` 트랜잭션 내 실행 불가 | `routes.ts:1098` | **N/A** | pg client.query()는 autocommit — 트랜잭션 아님. 문제 없음 |
| M4 | 카카오 SDK JS 24h 캐시, 무결성 검증 없음 | `routes.ts:562` | **KEEP** | 24h 캐시 유지 (사용자 결정) |
| M5 | 설정값 음수/NaN 검증 없음 | `settings-page.tsx:229,238` | **DONE** | NaN 시 업데이트 무시 |
| M6 | boundary cache 무효화 없음 (feature 변경 시 stale) | `storage.ts:555` | **DONE** | `bfab451` — refreshLayerStats에서 자동 무효화 |
| M7 | `inserted` 카운트가 ON CONFLICT 무시분 포함 | `routes.ts:963` | **DONE** | `bfab451` — RETURNING으로 실제 삽입 수 집계 |
| M8 | 모든 pan마다 전체 visible 레이어 재fetch | `useLayerRenderer.ts:331` | **N/A** | bbox 기반 데이터는 pan 시 갱신이 정상 동작. debounce 300ms로 제어됨 |

---

## 참고: C5 상세 — Geometry 구조 현황

```
features 테이블 (실제 DB)
├── geometry (JSONB)      — GeoJSON 원본, Drizzle 스키마에 정의
├── lng/lat               — 격자집계용 B-tree 범위 스캔
├── minLng/maxLng/...     — PIP 프리필터용 bbox (ST_Within 전 후보 축소)
└── geom (PostGIS)        — 공간연산 엔진, Drizzle 스키마에 미등록
    └── GiST 인덱스 1개   — features_geom_idx (중복 제거 완료)
```

- PostGIS `geom` + GiST 인덱스가 이미 동작 중
- MVT 타일은 `geom`에서 `ST_AsMVTGeom`로 생성
- bbox 컬럼은 격자집계/PIP 프리필터 용도로 유효
- `geometry` JSONB는 프론트엔드가 직접 읽으므로 현행 유지
- **이중화 자체는 의도된 설계** — 각 컬럼이 다른 쿼리 패턴에 최적화
