# Engineering Review — 2026-04-08

## Summary

| 심각도 | 발견 | 해결 | 잔여 |
|--------|------|------|------|
| Critical | 5 | 5 | 0 |
| High | 8 | 6 | 2 |
| Medium | 8 | 0 | 8 |

---

## Critical

| # | 이슈 | 위치 | 상태 | 대응 |
|---|------|------|------|------|
| C1 | Shell injection — `execSync("unzip ...")` 사용 | `routes.ts:761,784` | **DONE** | `b590caa` — adm-zip + fs.rmSync으로 교체 |
| C2 | 첫 유저 admin 승격 레이스컨디션 — 동시 register 시 둘 다 admin | `routes.ts:88-92` | **DONE** | `4ecb88b` — `createUserWithAutoAdmin` 트랜잭션 + FOR UPDATE |
| C3 | OAuth 센티넬 비밀번호 `"!oauth-no-local-login!"` — 로그인에서 통과 가능성 | `routes.ts:165` | **DONE** | `4ecb88b` — `crypto.randomUUID()` 해시로 변경 |
| C4 | FK 제약 없음 — 고아 레코드 발생 가능 | `schema.ts` | **DONE** | `3add5dd` — CASCADE/SET NULL FK 5개 추가 |
| C5 | Geometry 이중화 — JSONB + PostGIS `geom` 병존, GiST 인덱스 중복 | `schema.ts`, DB | **DONE** | 중복 GiST 인덱스 제거 완료. 이중화 자체는 의도된 설계 (각 컬럼이 다른 쿼리 패턴 최적화). Drizzle 미등록은 현행 유지. |

## High

| # | 이슈 | 위치 | 상태 | 대응 |
|---|------|------|------|------|
| H1 | WMS/WFS 프록시 오픈 릴레이 — 인증 없이 VWORLD_KEY 노출, SSRF | `routes.ts:496-552` | **DONE** | `b590caa` — WMS/WFS에 requireAuth 추가 |
| H2 | Rate limiting 없음 — 로그인/회원가입 brute force 가능 | `routes.ts` 전체 | **DONE** | `b590caa` — express-rate-limit 15분/20회 |
| H3 | WFS 메모리 누수 — features가 addFeatures로 계속 쌓임 | `useLayerRenderer.ts:252-287` | TODO | viewport 이동 시 이전 features clear |
| H4 | OL 레이어 unmount 시 미정리 — cleanup 함수 없음 | `useLayerRenderer.ts` | TODO | useEffect return에서 removeLayer/dispose |
| H5 | fetchAndRenderLayer 레이스 — clear 후 fetch 전 빈 화면 | `useLayerRenderer.ts:111` | TODO | fetch 완료 후 clear → add 순서로 변경 |
| H6 | deleteLayer/createFeatures 트랜잭션 없음 — 부분 실패 시 불일치 | `storage.ts:113,153` | **DONE** | `df8dcf6` — createFeature/createFeatures/setDefaultBasemap 트랜잭션 래핑 |
| H7 | 캐시 테이블 유니크 제약 없음 — 동시 빌드 시 중복 삽입 | `schema.ts` | **DONE** | `df8dcf6` — boundary/grid 캐시 유니크 인덱스, admin_boundaries.code 유니크 |
| H8 | 감사로그 엔드포인트 admin 가드 없음 | `routes.ts:194` | **DONE** | `b590caa` — audit-logs/build-cache에 requireAdmin 적용 |

## Medium

| # | 이슈 | 위치 | 상태 | 대응 |
|---|------|------|------|------|
| M1 | radius 무제한 (999999 → 풀스캔) | `routes.ts:453` | TODO | max radius 제한 (예: 50000m) |
| M2 | 업로드 실패 시 temp 파일 미정리 | `routes.ts:730` | TODO | finally 블록에서 cleanup |
| M3 | `CREATE INDEX CONCURRENTLY` 트랜잭션 내 실행 불가 | `routes.ts:1098` | TODO | 별도 커넥션에서 실행 |
| M4 | 카카오 SDK JS 24h 캐시, 무결성 검증 없음 | `routes.ts:554` | TODO | SRI hash 또는 캐시 시간 축소 |
| M5 | 설정값 음수/NaN 검증 없음 | `settings-page.tsx:250` | TODO | 입력 범위 validation 추가 |
| M6 | boundary cache 무효화 없음 (feature 변경 시 stale) | `storage.ts:450` | TODO | feature 변경 시 관련 캐시 삭제 트리거 |
| M7 | `inserted` 카운트가 ON CONFLICT 무시분 포함 | `routes.ts:956` | TODO | RETURNING으로 실제 삽입 수 집계 |
| M8 | 모든 pan마다 전체 visible 레이어 재fetch | `useLayerRenderer.ts:331` | TODO | 줌 변경 시만 줌 민감 레이어 재fetch |

---

## 참고: C5 상세 — Geometry 구조 현황

```
features 테이블 (실제 DB)
├── geometry (JSONB)      — GeoJSON 원본, Drizzle 스키마에 정의
├── lng/lat               — 격자집계용 B-tree 범위 스캔
├── minLng/maxLng/...     — PIP 프리필터용 bbox (ST_Within 전 후보 축소)
└── geom (PostGIS)        — 공간연산 엔진, Drizzle 스키마에 미등록
    └── GiST 인덱스 2개   — features_geom_idx, features_geom_gist_idx (중복)
```

- PostGIS `geom` + GiST 인덱스가 이미 동작 중
- MVT 타일은 `geom`에서 `ST_AsMVTGeom`로 생성
- bbox 컬럼은 격자집계/PIP 프리필터 용도로 유효
- `geometry` JSONB는 프론트엔드가 직접 읽으므로 현행 유지
- **이중화 자체는 의도된 설계** — 각 컬럼이 다른 쿼리 패턴에 최적화
