# GIS 업무 솔루션 - 공간데이터 플랫폼

## 개요
조달청 등록을 목표로 하는 업무용 GIS 솔루션. 대용량 공간데이터 관리를 위한 벡터 타일 렌더링 전략 문서 기반. React + Express + PostgreSQL 구성 (PostGIS 미사용 - 애플리케이션 레벨 공간 연산). 다크 네이비/시안 테마, ESRI 위성 배경지도 기본값.

## 아키텍처

### 프론트엔드
- **React** + TypeScript
- **OpenLayers** 지도 렌더링 (VectorLayer, VectorSource, GeoJSON, XYZ 타일 소스)
- **Shadcn UI** 컴포넌트 + Tailwind CSS
- **TanStack React Query** 데이터 페칭
- **다크 테마 기본값** - 다크 네이비 배경 (210 20% 6%), 시안/틸 액센트 (190 85% 50%)
- 줌 기반 렌더링: 저줌 집계 클러스터, 고줌 개별 피처
- 배경지도 관리: 설정 다이얼로그에서 관리 (사이드바에서 제외)
- 전체 화면 지도 + 상단 중앙 검색 오버레이 + 우측 줌 컨트롤
- 사이드바: 토글 스위치 + 타입 배지 (VECTOR/RASTER/DEM/HEATMAP)

### 백엔드
- **Express.js** REST API
- **PostgreSQL** + Drizzle ORM
- SQL 기반 공간 연산 (BBOX 필터링, 그리드 집계, 반경 검색)
- lat/lng 컬럼 인덱싱으로 빠른 공간 쿼리

### 데이터 모델
- `layers` - 레이어 메타데이터 (렌더링 모드, 피처 제한, 최소 줌, 타일 설정 등)
- `features` - GeoJSON 지오메트리 + 인덱싱된 lat/lng/bbox 컬럼
- `basemaps` - 배경지도 제공자 설정 (provider, URL 템플릿, API 키, 활성/기본 플래그)
- `app_settings` - 애플리케이션 설정 (키-값, 카테고리: rendering, map)
- `spatial_queries` - 저장된 공간 쿼리 이력

## 주요 파일
- `client/src/pages/product-info.tsx` - 제품 소개 페이지 (기능 설명, 기술 스택)
- `shared/schema.ts` - Drizzle 스키마 정의
- `server/routes.ts` - API 엔드포인트 (레이어 CRUD, 피처, 집계, 공간 쿼리, 배경지도, 설정)
- `server/storage.ts` - DatabaseStorage (공간 연산 포함)
- `server/seed.ts` - 시드 데이터 (서울: 공공시설 200개, 도로 30개, 행정구역 5개, 기본 배경지도, 기본 설정)
- `client/src/App.tsx` - 메인 레이아웃: 사이드바 + 전체 화면 지도 (상단 헤더 없음)
- `client/src/components/map-viewer.tsx` - OpenLayers 지도 (검색 오버레이, 줌 컨트롤, 배경지도 전환, 타일 에러 감지)
- `client/src/components/app-sidebar.tsx` - 사이드바: 한글 제목, 작업 공간 선택, 레이어 토글/배지, 내보내기/설정 푸터
- `client/src/components/settings-dialog.tsx` - 설정 다이얼로그 (배경지도, 렌더링, 지도, ML 연산 서버 설정)
- `client/src/components/add-layer-dialog.tsx` - 레이어 추가 다이얼로그
- `client/src/components/spatial-analysis-panel.tsx` - 공간 분석 패널 (클러스터링, 이상치, 핫스팟, 통계)
- `client/src/components/radius-search-panel.tsx` - 반경 검색 도구
- `client/src/components/feature-info-panel.tsx` - 레이어 정보 패널
- `client/src/components/theme-provider.tsx` - 다크/라이트 모드 (기본 다크)

## UI 디자인
- **테마**: 다크 네이비 (#0e1117) 배경, 시안/틸 (#00c8dc) 주 액센트
- **사이드바**: "GIS 업무 솔루션" 제목, 활성 작업 공간 선택, Switch 토글 + 타입 배지 레이어 목록
- **지도**: ESRI 위성 배경지도 기본, 상단 좌표 검색, 우측 줌 +/- 버튼
- **헤더 없음**: 사이드바 옆 지도가 전체 높이 차지
- **배경지도**: ESRI 위성 (기본, API 키 불필요), OSM, VWorld (API 키 필요), Naver/Kakao (SDK 필요)

## API 엔드포인트
- `GET /api/layers` - 레이어 목록
- `POST /api/layers` - 레이어 생성
- `PATCH /api/layers/:id` - 레이어 수정
- `DELETE /api/layers/:id` - 레이어 삭제
- `GET /api/layers/:id/features?bbox=&limit=&zoom=` - 피처 조회 (BBOX 필터링)
- `POST /api/layers/:id/features` - 피처 추가 (단일/배치)
- `GET /api/layers/:id/aggregate?bbox=&gridSize=` - 그리드 집계
- `GET /api/spatial/radius?lng=&lat=&radius=` - 반경 검색
- `GET /api/stats` - 시스템 통계
- `GET /api/basemaps` - 배경지도 목록
- `POST /api/basemaps` - 배경지도 추가
- `PATCH /api/basemaps/:id` - 배경지도 수정
- `DELETE /api/basemaps/:id` - 배경지도 삭제
- `POST /api/basemaps/:id/default` - 기본 배경지도 설정
- `GET /api/settings` - 설정 목록
- `GET /api/settings/:key` - 설정 조회
- `PUT /api/settings/:key` - 설정 수정

## 성능 전략 (렌더링 전략 문서 기반)
- 저줌 (Z0-12): 그리드 집계 + 클러스터 시각화
- 중줌 (Z13-14): 피처 제한 적용
- 고줌 (Z15+): BBOX 필터링으로 전체 피처 상세 표시
- 모든 피처 쿼리에 BBOX + LIMIT 적용
- 레이어별 렌더링 동작 제어
- 지도 이동/줌 디바운스 (300ms, 설정 가능)

## 설정 카테고리
- **rendering**: 기본 렌더링 모드, 피처 제한, 최소 줌, 집계 그리드 크기, 디바운스
- **map**: 기본 중심점, 기본 줌, 최대/최소 줌

## 사용자 환경설정
- 커뮤니케이션 언어: 한국어
- UI 표시 언어: 한국어
