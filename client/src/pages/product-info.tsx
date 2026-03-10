import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Layers,
  Map,
  Zap,
  Shield,
  Database,
  Globe,
  Monitor,
  Search,
  BarChart3,
  FileDown,
  Settings,
  MapPin,
  Maximize,
  Grid3X3,
  Eye,
  CheckCircle2,
  Circle,
  Milestone,
} from "lucide-react";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  tags?: string[];
}

function FeatureCard({ icon, title, description, tags }: FeatureCardProps) {
  return (
    <div
      className="group relative p-5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm transition-all duration-200 hover:border-primary/40 hover:bg-card/80"
      data-testid={`card-feature-${title.replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold mb-1.5">{title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 h-4 bg-primary/5 text-primary/80 border-primary/20"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductInfoPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-to-map">
              <ArrowLeft className="w-4 h-4 mr-2" />
              지도로 돌아가기
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-5">
            <Globe className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2" data-testid="text-product-title">
            BIGSPACE Public
          </h1>
          <p className="text-sm text-muted-foreground mb-3" data-testid="text-product-subtitle">
            고성능 공간정보 관리 플랫폼 · v1.3
          </p>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
              v1.3
            </Badge>
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              조달청 등록 대상
            </Badge>
          </div>
        </div>

        <div className="mb-10 p-6 rounded-xl bg-card/50 border border-border/60">
          <p className="text-sm text-muted-foreground leading-relaxed text-center max-w-3xl mx-auto" data-testid="text-product-description">
            대한민국 공공기관 및 기업의 공간정보 업무를 위한 웹 기반 GIS 솔루션입니다. 
            대용량 공간 데이터의 효율적 관리, 고성능 시각화, 다양한 공간 분석 기능을 제공하며, 
            조달청 등록을 목표로 보안성과 안정성을 갖추고 있습니다.
          </p>
        </div>

        <section className="mb-10">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            핵심 GIS 기능
          </h2>
          <p className="text-xs text-muted-foreground mb-5">공간정보 관리의 기본이 되는 핵심 기능</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FeatureCard
              icon={<Layers className="w-5 h-5" />}
              title="다중 레이어 관리"
              description="벡터, 래스터, DEM, 히트맵 등 다양한 유형의 레이어를 동시에 관리하고 표시할 수 있습니다. 레이어별 가시성, 스타일, 렌더링 모드를 독립적으로 제어합니다."
              tags={["VECTOR", "RASTER", "DEM", "HEATMAP"]}
            />
            <FeatureCard
              icon={<Map className="w-5 h-5" />}
              title="다중 배경지도 지원"
              description="ESRI 위성영상, OpenStreetMap, VWorld 등 다양한 배경지도를 지원합니다. API 키 기반 타일 서비스와 표준 XYZ 타일 소스를 유연하게 설정할 수 있습니다."
              tags={["ESRI 위성", "OSM", "VWorld", "XYZ 타일"]}
            />
            <FeatureCard
              icon={<Search className="w-5 h-5" />}
              title="공간 검색 및 쿼리"
              description="좌표 기반 위치 검색, 반경 검색, BBOX(경계 상자) 필터링 등 다양한 공간 쿼리를 수행할 수 있습니다. 검색 결과를 지도 위에 실시간으로 시각화합니다."
              tags={["좌표 검색", "반경 검색", "BBOX 필터"]}
            />
            <FeatureCard
              icon={<MapPin className="w-5 h-5" />}
              title="GeoJSON 피처 관리"
              description="Point, LineString, Polygon 등 모든 GeoJSON 지오메트리 타입을 지원합니다. 개별 또는 대량(배치) 피처 등록이 가능하며, 사용자 정의 속성을 자유롭게 추가할 수 있습니다."
              tags={["Point", "LineString", "Polygon", "배치 등록"]}
            />
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            고성능 렌더링
          </h2>
          <p className="text-xs text-muted-foreground mb-5">대용량 데이터도 빠르고 부드럽게 표시하는 렌더링 전략</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FeatureCard
              icon={<Grid3X3 className="w-5 h-5" />}
              title="줌 레벨 기반 적응형 렌더링"
              description="저줌(Z0-12)에서는 그리드 집계 클러스터, 중줌(Z13-14)에서는 피처 제한, 고줌(Z15+)에서는 전체 피처를 상세 표시합니다. 줌 레벨에 따라 자동으로 최적의 렌더링 방식을 선택합니다."
              tags={["그리드 집계", "클러스터", "BBOX 필터링"]}
            />
            <FeatureCard
              icon={<BarChart3 className="w-5 h-5" />}
              title="클러스터 면적 비례 시각화"
              description="클러스터 마커의 면적이 데이터 수에 정비례하여 직관적으로 밀도를 파악할 수 있습니다. 소규모 데이터는 √(count) 비례, 대규모 데이터는 로그 스케일로 완만하게 표현합니다."
              tags={["√ 비례", "로그 스케일", "면적 비례"]}
            />
            <FeatureCard
              icon={<Maximize className="w-5 h-5" />}
              title="뷰포트 기반 데이터 로딩"
              description="현재 화면에 보이는 영역(BBOX)의 데이터만 서버에서 조회합니다. 지도 이동/확대 시 디바운스(300ms)를 적용하여 불필요한 요청을 최소화합니다."
              tags={["BBOX 쿼리", "디바운스", "지연 로딩"]}
            />
            <FeatureCard
              icon={<Eye className="w-5 h-5" />}
              title="레이어별 렌더링 제어"
              description="레이어마다 독립적인 렌더링 모드, 피처 제한, 최소 줌 레벨, 타일 설정 등을 지정할 수 있습니다. 데이터 특성에 맞는 최적의 표시 방식을 선택합니다."
              tags={["렌더링 모드", "피처 제한", "줌 제어"]}
            />
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            데이터 관리 및 분석
          </h2>
          <p className="text-xs text-muted-foreground mb-5">공간 데이터의 저장, 조회, 분석을 위한 기능</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FeatureCard
              icon={<Database className="w-5 h-5" />}
              title="PostgreSQL 공간 데이터 엔진"
              description="PostgreSQL 기반의 안정적인 데이터 저장소를 사용합니다. lat/lng 컬럼 인덱싱과 SQL 기반 공간 연산으로 빠른 조회 성능을 제공하며, PostGIS 없이도 효율적인 공간 쿼리를 수행합니다."
              tags={["PostgreSQL", "인덱싱", "SQL 공간 연산"]}
            />
            <FeatureCard
              icon={<FileDown className="w-5 h-5" />}
              title="데이터 내보내기"
              description="레이어 데이터를 GeoJSON 형식으로 내보낼 수 있습니다. 공간 쿼리 결과를 저장하고 이력을 관리하여 반복 분석 작업을 효율화합니다."
              tags={["GeoJSON", "쿼리 이력", "데이터 추출"]}
            />
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            보안 및 인프라
          </h2>
          <p className="text-xs text-muted-foreground mb-5">안정적인 운영을 위한 보안 및 시스템 기능</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FeatureCard
              icon={<Shield className="w-5 h-5" />}
              title="보안 설계 기반"
              description="환경 변수를 통한 비밀 키 관리, 입력 데이터 검증(Zod 스키마) 등 보안 기반을 갖추고 있으며, 사용자 인증 및 권한 관리(RBAC)는 Phase 2에서 구현 예정입니다."
              tags={["입력 검증", "보안 키 관리", "RBAC 예정"]}
            />
            <FeatureCard
              icon={<Monitor className="w-5 h-5" />}
              title="반응형 다크 테마 UI"
              description="다크 네이비 기반의 전문적인 인터페이스를 기본 제공합니다. 시안/틸 색상 액센트로 핵심 정보를 강조하며, 장시간 작업 시 눈의 피로를 최소화합니다."
              tags={["다크 테마", "시안 액센트", "반응형"]}
            />
            <FeatureCard
              icon={<Settings className="w-5 h-5" />}
              title="시스템 설정 관리"
              description="렌더링 파라미터, 지도 기본값, 배경지도 설정 등을 관리 화면에서 실시간으로 변경할 수 있습니다. 설정은 서버에 영구 저장되어 팀 전체에 일관된 환경을 제공합니다."
              tags={["렌더링 설정", "지도 설정", "영구 저장"]}
            />
            <FeatureCard
              icon={<Globe className="w-5 h-5" />}
              title="한국 좌표계 지원 (예정)"
              description="EPSG:5179, EPSG:5181 등 대한민국 공공 좌표계 지원을 준비 중입니다. VWorld, 네이버, 카카오 등 국내 지도 서비스와의 연동도 계획되어 있습니다."
              tags={["EPSG:5179", "EPSG:5181", "국내 지도 연동"]}
            />
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            기술 스택
          </h2>
          <p className="text-xs text-muted-foreground mb-5">검증된 오픈소스 기술 기반의 안정적인 아키텍처</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: "React", desc: "프론트엔드 프레임워크" },
              { name: "TypeScript", desc: "타입 안전성" },
              { name: "OpenLayers", desc: "지도 렌더링 엔진" },
              { name: "Express.js", desc: "백엔드 서버" },
              { name: "PostgreSQL", desc: "관계형 데이터베이스" },
              { name: "Drizzle ORM", desc: "타입세이프 ORM" },
              { name: "Tailwind CSS", desc: "스타일링" },
              { name: "TanStack Query", desc: "데이터 동기화" },
            ].map((tech) => (
              <div
                key={tech.name}
                className="p-3 rounded-lg border border-border/50 bg-card/30 text-center"
                data-testid={`card-tech-${tech.name}`}
              >
                <p className="text-xs font-semibold mb-0.5">{tech.name}</p>
                <p className="text-[10px] text-muted-foreground">{tech.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <hr className="border-border/40 my-12" />

        <section className="mb-10" data-testid="section-current-status">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            현재 구현 상태
          </h2>
          <p className="text-xs text-muted-foreground mb-5">구현 완료된 기능과 아직 개발이 필요한 기능</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0">
            <div>
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-3">구현 완료</p>
              <ul className="space-y-2.5">
                {[
                  "EPSG:4326(WGS84) GeoJSON 데이터 저장 및 표시",
                  "OpenLayers 내부 EPSG:3857 자동 변환",
                  "다중 레이어 관리 (VECTOR / RASTER / DEM / HEATMAP)",
                  "줌 레벨 기반 적응형 렌더링 (클러스터 / 피처 제한 / BBOX)",
                  "클러스터 면적 비례 시각화 (√ + 로그 하이브리드)",
                  "BBOX 뷰포트 필터링 및 반경 검색",
                  "다중 배경지도 전환 (ESRI 위성, OSM, VWorld)",
                  "시스템 설정 관리 (렌더링, 지도 파라미터)",
                  "다크 네이비 / 시안 테마 UI",
                  "좌표 검색 오버레이",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5" data-testid={`status-done-${i}`}>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 md:mt-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">미구현 (개발 예정)</p>
              <ul className="space-y-2.5">
                {[
                  "SHP / GeoPackage 파일 업로드 및 파싱",
                  "한국 좌표계 변환 (EPSG:5179 / 5181 / 5186 ↔ WGS84)",
                  "서로 다른 좌표계 데이터 중첩 표시",
                  "사용자 인증 및 역할 기반 권한 관리 (RBAC)",
                  "감사 로그 (Audit Log)",
                  "WebGL 가속 렌더링",
                  "타일 캐싱 (Redis / CDN)",
                  "네이버 / 카카오 지도 SDK 연동",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5" data-testid={`status-pending-${i}`}>
                    <Circle className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-12" data-testid="section-roadmap">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <Milestone className="w-4 h-4 text-primary" />
            개발 로드맵
          </h2>
          <p className="text-xs text-muted-foreground mb-6">향후 개발 계획 및 우선순위</p>

          <div className="space-y-4">
            <div className="relative pl-8 pb-6 border-l-2 border-primary/40" data-testid="roadmap-phase-1">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-2 border-background" />
              <div className="p-4 rounded-xl border border-border/60 bg-card/50">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/30">
                    Phase 1
                  </Badge>
                  <span className="text-xs font-semibold">좌표계 변환 및 파일 업로드</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-400 border-amber-500/30">
                    단기
                  </Badge>
                </div>
                <ul className="space-y-1.5">
                  {[
                    "shpjs 라이브러리로 SHP 파일 업로드 → GeoJSON 자동 변환",
                    "proj4js 좌표계 변환 엔진 탑재",
                    "업로드 시 원본 좌표계 지정 → WGS84 자동 변환 후 저장",
                    "레이어 메타데이터에 원본 SRID 보존",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary mt-1">·</span>
                      <span className="text-xs text-muted-foreground leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="relative pl-8 pb-6 border-l-2 border-border/40" data-testid="roadmap-phase-2">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-muted-foreground/30 border-2 border-background" />
              <div className="p-4 rounded-xl border border-border/60 bg-card/50">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/30">
                    Phase 2
                  </Badge>
                  <span className="text-xs font-semibold">보안 및 데이터 고도화</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-sky-500/10 text-sky-400 border-sky-500/30">
                    중기
                  </Badge>
                </div>
                <ul className="space-y-1.5">
                  {[
                    "사용자 인증 / 권한 관리 (RBAC)",
                    "감사 로그 — 사용자 행위 기록 및 추적",
                    "GeoPackage 파일 지원",
                    "다양한 내보내기 형식 (SHP / KML / CSV)",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground mt-1">·</span>
                      <span className="text-xs text-muted-foreground leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="relative pl-8" data-testid="roadmap-phase-3">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-muted-foreground/20 border-2 border-background" />
              <div className="p-4 rounded-xl border border-border/60 bg-card/50">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/30">
                    Phase 3
                  </Badge>
                  <span className="text-xs font-semibold">고성능 및 인증</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-violet-500/10 text-violet-400 border-violet-500/30">
                    장기
                  </Badge>
                </div>
                <ul className="space-y-1.5">
                  {[
                    "WebGL 기반 대용량 렌더링 가속",
                    "타일 캐싱 인프라 (Redis / CDN)",
                    "네이버 / 카카오 지도 SDK 연동",
                    "3D 지형 시각화",
                    "조달청 GS 인증 취득",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground mt-1">·</span>
                      <span className="text-xs text-muted-foreground leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <div className="text-center pb-8">
          <Link href="/">
            <Button variant="default" size="sm" data-testid="button-start-using">
              <Map className="w-4 h-4 mr-2" />
              지도 화면으로 이동
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
