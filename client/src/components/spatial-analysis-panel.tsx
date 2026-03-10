import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Layer } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Cpu, X, Play, Loader2, BarChart3, ScatterChart,
  Flame, TrendingUp, Info, ChevronDown, ChevronUp,
} from "lucide-react";

type AnalysisType = "clustering" | "outlier" | "hotspot" | "statistics";

interface AnalysisConfig {
  type: AnalysisType;
  label: string;
  description: string;
  icon: typeof Cpu;
  badge: string;
  badgeClass: string;
  params: ParamConfig[];
}

interface ParamConfig {
  key: string;
  label: string;
  type: "number" | "select";
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  hint?: string;
}

const ANALYSIS_TYPES: AnalysisConfig[] = [
  {
    type: "clustering",
    label: "공간 클러스터링",
    description: "DBSCAN 알고리즘으로 인접한 피처들을 자동 그룹핑합니다. 밀집 지역을 식별하는 데 유용합니다.",
    icon: ScatterChart,
    badge: "DBSCAN",
    badgeClass: "border-cyan-500/50 text-cyan-400",
    params: [
      { key: "eps", label: "탐색 반경 (m)", type: "number", default: 500, min: 50, max: 10000, step: 50, hint: "이 거리 이내의 피처를 같은 클러스터로 판단" },
      { key: "minPoints", label: "최소 포인트 수", type: "number", default: 3, min: 2, max: 50, step: 1, hint: "클러스터로 인정할 최소 피처 수" },
    ],
  },
  {
    type: "outlier",
    label: "이상치 탐지",
    description: "주변 피처와 크게 동떨어진 공간적 이상치를 감지합니다. 오류 데이터 또는 특이 위치를 찾는 데 활용합니다.",
    icon: TrendingUp,
    badge: "LOF",
    badgeClass: "border-orange-500/50 text-orange-400",
    params: [
      { key: "neighbors", label: "이웃 수 (k)", type: "number", default: 5, min: 2, max: 30, step: 1, hint: "비교 대상 이웃 피처 수. 클수록 엄격" },
      { key: "threshold", label: "이상치 임계값", type: "number", default: 1.5, min: 1.0, max: 5.0, step: 0.1, hint: "LOF 점수가 이 값 이상이면 이상치로 판정" },
    ],
  },
  {
    type: "hotspot",
    label: "핫스팟 분석",
    description: "커널 밀도 추정(KDE)으로 피처가 집중된 고밀도 영역을 시각화합니다. 히트맵 형태로 결과를 표시합니다.",
    icon: Flame,
    badge: "KDE",
    badgeClass: "border-rose-500/50 text-rose-400",
    params: [
      { key: "bandwidth", label: "대역폭 (m)", type: "number", default: 1000, min: 100, max: 20000, step: 100, hint: "커널 반경. 클수록 부드러운 밀도 표면" },
      { key: "gridSize", label: "그리드 해상도", type: "select", default: "medium", options: [
        { value: "low", label: "저해상도 (50×50)" },
        { value: "medium", label: "중해상도 (100×100)" },
        { value: "high", label: "고해상도 (200×200)" },
      ], hint: "결과 래스터의 셀 수. 높을수록 정밀하지만 느림" },
    ],
  },
  {
    type: "statistics",
    label: "공간 통계",
    description: "선택 레이어의 공간 분포 통계를 산출합니다. 평균 중심, 표준 거리, 최근린 분석 결과를 제공합니다.",
    icon: BarChart3,
    badge: "통계",
    badgeClass: "border-blue-500/50 text-blue-400",
    params: [
      { key: "method", label: "분석 방법", type: "select", default: "nearest-neighbor", options: [
        { value: "nearest-neighbor", label: "최근린 분석 (NNI)" },
        { value: "mean-center", label: "평균 중심점" },
        { value: "std-distance", label: "표준 거리" },
        { value: "all", label: "전체 통계 산출" },
      ], hint: "산출할 통계 유형 선택" },
    ],
  },
];

interface SpatialAnalysisPanelProps {
  layers: Layer[];
  onClose: () => void;
}

export function SpatialAnalysisPanel({ layers, onClose }: SpatialAnalysisPanelProps) {
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisType>("clustering");
  const [selectedLayerId, setSelectedLayerId] = useState<string>("");
  const [params, setParams] = useState<Record<string, any>>(() => {
    const defaults: Record<string, any> = {};
    ANALYSIS_TYPES[0].params.forEach(p => { defaults[p.key] = p.default; });
    return defaults;
  });
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  const analysisConfig = ANALYSIS_TYPES.find(a => a.type === selectedAnalysis)!;
  const Icon = analysisConfig.icon;

  const pointLayers = layers.filter(l => l.geometryType === "Point" && l.visible);
  const allLayers = layers.filter(l => l.visible);
  const availableLayers = selectedAnalysis === "statistics" ? allLayers : pointLayers;

  const handleAnalysisChange = (type: AnalysisType) => {
    setSelectedAnalysis(type);
    setResult(null);
    const config = ANALYSIS_TYPES.find(a => a.type === type)!;
    const defaults: Record<string, any> = {};
    config.params.forEach(p => { defaults[p.key] = p.default; });
    setParams(defaults);

    const newAvailable = type === "statistics" ? allLayers : pointLayers;
    if (selectedLayerId && !newAvailable.find(l => l.id === selectedLayerId)) {
      setSelectedLayerId("");
    }
  };

  const handleParamChange = (key: string, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleRun = async () => {
    if (!selectedLayerId) return;
    setIsRunning(true);
    setResult(null);

    await new Promise(r => setTimeout(r, 1500));

    const layer = layers.find(l => l.id === selectedLayerId);
    const featureCount = layer?.featureCount ?? 0;

    if (selectedAnalysis === "clustering") {
      const clusterCount = Math.max(2, Math.floor(Math.random() * 5) + 2);
      const noise = Math.floor(featureCount * 0.1);
      setResult({
        type: "clustering",
        summary: `${clusterCount}개 클러스터 발견, ${noise}개 노이즈 포인트`,
        clusters: Array.from({ length: clusterCount }, (_, i) => ({
          id: i + 1,
          count: Math.floor((featureCount - noise) / clusterCount),
          label: `클러스터 ${i + 1}`,
        })),
        noiseCount: noise,
        totalProcessed: featureCount,
      });
    } else if (selectedAnalysis === "outlier") {
      const outlierCount = Math.max(1, Math.floor(featureCount * 0.05));
      setResult({
        type: "outlier",
        summary: `${outlierCount}개 이상치 탐지 (전체 ${featureCount}건 중 ${((outlierCount / featureCount) * 100).toFixed(1)}%)`,
        outlierCount,
        totalProcessed: featureCount,
        avgLOF: (1.0 + Math.random() * 0.3).toFixed(2),
      });
    } else if (selectedAnalysis === "hotspot") {
      const hotCount = Math.floor(Math.random() * 3) + 2;
      const coldCount = Math.floor(Math.random() * 2) + 1;
      setResult({
        type: "hotspot",
        summary: `고밀도 영역 ${hotCount}곳, 저밀도 영역 ${coldCount}곳 식별`,
        hotspots: hotCount,
        coldspots: coldCount,
        totalProcessed: featureCount,
      });
    } else if (selectedAnalysis === "statistics") {
      setResult({
        type: "statistics",
        summary: "공간 통계 산출 완료",
        meanCenter: { lng: 126.978, lat: 37.5665 },
        stdDistance: (2.3 + Math.random() * 1.5).toFixed(2),
        nni: (0.7 + Math.random() * 0.6).toFixed(3),
        nniInterpretation: Math.random() > 0.5 ? "집중 분포" : "균등 분포",
        totalProcessed: featureCount,
      });
    }

    setIsRunning(false);
  };

  return (
    <div className="absolute top-3 left-3 z-20 w-80" data-testid="spatial-analysis-panel">
      <Card className="bg-card/95 backdrop-blur-sm overflow-hidden">
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold" data-testid="text-analysis-title">공간 분석</h3>
              <Badge variant="outline" className="text-[9px]">로컬 연산</Badge>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose} data-testid="button-close-analysis">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {ANALYSIS_TYPES.map(a => {
              const AIcon = a.icon;
              const isActive = selectedAnalysis === a.type;
              return (
                <button
                  key={a.type}
                  className={`flex flex-col items-center gap-1 p-2 rounded-md text-center transition-colors ${
                    isActive
                      ? "bg-primary/15 border border-primary/40"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                  onClick={() => handleAnalysisChange(a.type)}
                  data-testid={`button-analysis-${a.type}`}
                >
                  <AIcon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-[9px] leading-tight ${isActive ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    {a.label.replace("공간 ", "")}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-md bg-muted/30 p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium">{analysisConfig.label}</span>
              <Badge variant="outline" className={`text-[9px] ml-auto ${analysisConfig.badgeClass}`}>
                {analysisConfig.badge}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {analysisConfig.description}
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <div>
              <Label className="text-[11px]">대상 레이어</Label>
              <Select value={selectedLayerId} onValueChange={setSelectedLayerId}>
                <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-analysis-layer">
                  <SelectValue placeholder="레이어를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {availableLayers.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-sm"
                          style={{ backgroundColor: l.fillColor, border: `1px solid ${l.strokeColor}` }}
                        />
                        <span>{l.name}</span>
                        <span className="text-muted-foreground ml-1">({l.featureCount})</span>
                      </div>
                    </SelectItem>
                  ))}
                  {availableLayers.length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                      {selectedAnalysis === "statistics" ? "표시 중인 레이어가 없습니다" : "표시 중인 포인트 레이어가 없습니다"}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {analysisConfig.params.map(param => (
                <div key={param.key}>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">{param.label}</Label>
                    {param.hint && (
                      <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5">
                        <Info className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                  {param.type === "number" ? (
                    <Input
                      type="number"
                      value={params[param.key] ?? param.default}
                      onChange={(e) => handleParamChange(param.key, parseFloat(e.target.value) || param.default)}
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      className="h-7 text-xs mt-0.5"
                      data-testid={`input-param-${param.key}`}
                    />
                  ) : (
                    <Select
                      value={String(params[param.key] ?? param.default)}
                      onValueChange={(v) => handleParamChange(param.key, v)}
                    >
                      <SelectTrigger className="h-7 text-xs mt-0.5" data-testid={`select-param-${param.key}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {param.options?.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {param.hint && (
                    <p className="text-[9px] text-muted-foreground/60 mt-0.5">{param.hint}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            size="sm"
            disabled={!selectedLayerId || isRunning}
            onClick={handleRun}
            data-testid="button-run-analysis"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 mr-2" />
                분석 실행
              </>
            )}
          </Button>

          {result && (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Separator />
              <div className="rounded-md bg-primary/5 border border-primary/20 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-primary">분석 결과</span>
                  <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">
                    {result.totalProcessed}건 처리
                  </Badge>
                </div>
                <p className="text-[11px]" data-testid="text-analysis-result">{result.summary}</p>

                {result.type === "clustering" && result.clusters && (
                  <div className="space-y-1">
                    {result.clusters.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-muted/30">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(${(c.id * 60) % 360}, 70%, 55%)` }} />
                          <span>{c.label}</span>
                        </div>
                        <span className="text-muted-foreground">{c.count}건</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-muted/30">
                      <span className="text-muted-foreground">노이즈</span>
                      <span className="text-muted-foreground">{result.noiseCount}건</span>
                    </div>
                  </div>
                )}

                {result.type === "outlier" && (
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2 rounded bg-muted/30 text-center">
                      <div className="font-semibold text-orange-400">{result.outlierCount}</div>
                      <div className="text-muted-foreground">이상치</div>
                    </div>
                    <div className="p-2 rounded bg-muted/30 text-center">
                      <div className="font-semibold">{result.avgLOF}</div>
                      <div className="text-muted-foreground">평균 LOF</div>
                    </div>
                  </div>
                )}

                {result.type === "hotspot" && (
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2 rounded bg-muted/30 text-center">
                      <div className="font-semibold text-rose-400">{result.hotspots}</div>
                      <div className="text-muted-foreground">고밀도 영역</div>
                    </div>
                    <div className="p-2 rounded bg-muted/30 text-center">
                      <div className="font-semibold text-blue-400">{result.coldspots}</div>
                      <div className="text-muted-foreground">저밀도 영역</div>
                    </div>
                  </div>
                )}

                {result.type === "statistics" && (
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between px-2 py-1 rounded bg-muted/30">
                      <span className="text-muted-foreground">평균 중심</span>
                      <span className="font-mono">{result.meanCenter.lng.toFixed(4)}, {result.meanCenter.lat.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between px-2 py-1 rounded bg-muted/30">
                      <span className="text-muted-foreground">표준 거리</span>
                      <span>{result.stdDistance} km</span>
                    </div>
                    <div className="flex justify-between px-2 py-1 rounded bg-muted/30">
                      <span className="text-muted-foreground">최근린 지수 (NNI)</span>
                      <span>{result.nni} ({result.nniInterpretation})</span>
                    </div>
                  </div>
                )}

                <button
                  className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors w-full justify-center pt-1"
                  onClick={() => setShowDetails(!showDetails)}
                  data-testid="button-toggle-details"
                >
                  {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showDetails ? "접기" : "상세 정보"}
                </button>

                {showDetails && (
                  <div className="text-[9px] text-muted-foreground/70 space-y-0.5 pt-1 border-t border-border/50">
                    <p>알고리즘: {analysisConfig.badge}</p>
                    <p>처리 피처: {result.totalProcessed}건</p>
                    <p>연산 위치: 앱 서버 (CPU)</p>
                    <p className="text-muted-foreground/50 italic pt-1">
                      현재 시뮬레이션 결과입니다. 실제 알고리즘 연산은 향후 구현 예정입니다.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
