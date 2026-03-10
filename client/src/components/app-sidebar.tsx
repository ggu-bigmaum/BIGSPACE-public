import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Layer } from "@shared/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Layers, Plus, Map, Download, Settings2, Globe, Info, Cpu, FolderOpen,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface AppSidebarProps {
  onLayerToggle?: (layerId: string, visible: boolean) => void;
  onLayerSelect?: (layerId: string | null) => void;
  onAddLayer?: () => void;
  onSettingsOpen?: () => void;
  onAnalysisOpen?: () => void;
  selectedLayerId?: string | null;
}

function getLayerTypeBadge(layer: Layer): string {
  const rm = layer.renderMode?.toLowerCase() ?? "";
  if (rm === "heatmap") return "HEATMAP";
  if (rm === "raster" || rm === "tile") return "RASTER";
  if (rm === "dem") return "DEM";
  return "VECTOR";
}

function getLayerSizeLabel(layer: Layer): string {
  if (layer.renderMode === "tile" || layer.renderMode === "heatmap") return "Stream";
  const count = layer.featureCount ?? 0;
  if (count > 100000) return `${Math.round(count / 1000)}K`;
  if (count > 1000) return `${(count / 1000).toFixed(1)}K`;
  return `${count}`;
}

export function AppSidebar({
  onLayerToggle,
  onLayerSelect,
  onAddLayer,
  onSettingsOpen,
  onAnalysisOpen,
  selectedLayerId,
}: AppSidebarProps) {
  const { toast } = useToast();

  const { data: layersData, isLoading } = useQuery<Layer[]>({
    queryKey: ["/api/layers"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      await apiRequest("PATCH", `/api/layers/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/layers"] });
    },
  });

  const badgeColorMap: Record<string, string> = {
    VECTOR: "bg-emerald-600/20 text-emerald-400 border-emerald-500/30",
    RASTER: "bg-violet-600/20 text-violet-400 border-violet-500/30",
    DEM: "bg-amber-600/20 text-amber-400 border-amber-500/30",
    HEATMAP: "bg-rose-600/20 text-rose-400 border-rose-500/30",
  };

  const badgeShortLabel: Record<string, string> = {
    VECTOR: "V", RASTER: "R", DEM: "D", HEATMAP: "H",
  };

  const badgeTooltip: Record<string, string> = {
    VECTOR: "Vector Data Source",
    RASTER: "Raster Data Source",
    DEM: "Digital Elevation Model",
    HEATMAP: "Heatmap Layer",
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold" data-testid="text-app-title">GIS 업무 솔루션</h2>
            <p className="text-[10px] text-muted-foreground" data-testid="text-app-version">v1.0 - Enterprise Edition</p>
          </div>
        </div>
      </SidebarHeader>

      <Separator />

      <SidebarContent className="overflow-y-auto scrollbar-none">
        <SidebarGroup>
          <div className="flex items-center justify-between gap-1 px-2">
            <SidebarGroupLabel className="px-0">
              <Layers className="w-3.5 h-3.5 mr-1.5" />
              레이어
            </SidebarGroupLabel>
            <Button
              size="icon"
              variant="ghost"
              onClick={onAddLayer}
              data-testid="button-add-layer"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <div className="px-2 py-2">
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </SidebarMenuItem>
                ))
              ) : layersData && layersData.length > 0 ? (
                (() => {
                  const grouped = layersData.reduce<Record<string, Layer[]>>((acc, layer) => {
                    const cat = layer.category || "일반";
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(layer);
                    return acc;
                  }, {});
                  const categories = Object.keys(grouped);

                  return categories.map((cat) => (
                    <div key={cat}>
                      {categories.length > 1 && (
                        <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1" data-testid={`category-label-${cat}`}>
                          <FolderOpen className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{cat}</span>
                        </div>
                      )}
                      {grouped[cat].map((layer) => {
                        const typeBadge = getLayerTypeBadge(layer);
                        const sizeLabel = getLayerSizeLabel(layer);
                        const isSelected = selectedLayerId === layer.id;
                        const badgeClass = badgeColorMap[typeBadge] || badgeColorMap.VECTOR;

                        return (
                          <SidebarMenuItem key={layer.id}>
                            <div
                              className={`flex items-start gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors ${isSelected ? "bg-accent" : "hover-elevate"}`}
                              onClick={() => onLayerSelect?.(isSelected ? null : layer.id)}
                              data-testid={`button-select-layer-${layer.id}`}
                            >
                              <Switch
                                checked={layer.visible}
                                onCheckedChange={(checked) => {
                                  updateMutation.mutate({ id: layer.id, updates: { visible: checked } });
                                  onLayerToggle?.(layer.id, checked);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-0.5 h-4 w-7 data-[state=checked]:bg-primary [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
                                data-testid={`switch-toggle-visibility-${layer.id}`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                    style={{ backgroundColor: layer.fillColor, border: `1px solid ${layer.strokeColor}` }}
                                  />
                                  <span
                                    className={`text-xs font-medium truncate ${!layer.visible ? "text-muted-foreground" : ""}`}
                                    data-testid={`text-layer-name-${layer.id}`}
                                  >
                                    {layer.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <TooltipProvider delayDuration={300}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span
                                          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold border ${badgeClass} no-default-hover-elevate no-default-active-elevate`}
                                          data-testid={`badge-layer-type-${layer.id}`}
                                        >
                                          {badgeShortLabel[typeBadge] || typeBadge}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom" className="text-xs">
                                        {badgeTooltip[typeBadge] || typeBadge}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <span className="text-[9px] text-muted-foreground">·</span>
                                  <span className="text-[9px] text-muted-foreground" data-testid={`text-layer-size-${layer.id}`}>
                                    {sizeLabel}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </SidebarMenuItem>
                        );
                      })}
                    </div>
                  ));
                })()
              ) : (
                <SidebarMenuItem>
                  <div className="px-3 py-4 text-center">
                    <Map className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground" data-testid="text-no-layers">레이어가 없습니다</p>
                    <p className="text-[10px] text-muted-foreground/60">+ 버튼을 눌러 추가하세요</p>
                  </div>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <div className="px-3 pt-2 pb-3">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">배지 디자인 미리보기</div>
            <div className="space-y-2.5 bg-card/60 rounded-lg p-2.5 border border-border/50">

              <div className="flex items-center gap-2" data-testid="badge-preview-1">
                <span className="text-[10px] text-muted-foreground w-3">①</span>
                <span className="inline-flex items-center justify-center h-5 px-2 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-sm">V</span>
                <span className="inline-flex items-center justify-center h-5 px-2 rounded-full bg-violet-500 text-white text-[10px] font-bold shadow-sm">R</span>
                <span className="inline-flex items-center justify-center h-5 px-2 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-sm">D</span>
                <span className="inline-flex items-center justify-center h-5 px-2 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-sm">H</span>
                <span className="text-[9px] text-muted-foreground/70 ml-auto">Pill 채움</span>
              </div>

              <div className="flex items-center gap-2" data-testid="badge-preview-2">
                <span className="text-[10px] text-muted-foreground w-3">②</span>
                <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-emerald-500/15 text-emerald-500 text-[10px] font-semibold border border-emerald-500/25">
                  <Layers className="w-3 h-3" />V
                </span>
                <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-violet-500/15 text-violet-500 text-[10px] font-semibold border border-violet-500/25">
                  <Layers className="w-3 h-3" />R
                </span>
                <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-amber-500/15 text-amber-500 text-[10px] font-semibold border border-amber-500/25">
                  <Layers className="w-3 h-3" />D
                </span>
                <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-rose-500/15 text-rose-500 text-[10px] font-semibold border border-rose-500/25">
                  <Layers className="w-3 h-3" />H
                </span>
                <span className="text-[9px] text-muted-foreground/70 ml-auto">아이콘</span>
              </div>

              <div className="flex items-center gap-2" data-testid="badge-preview-3">
                <span className="text-[10px] text-muted-foreground w-3">③</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />벡터
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-violet-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-violet-400" />래스터
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />DEM
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />히트맵
                </span>
                <span className="text-[9px] text-muted-foreground/70 ml-auto">도트</span>
              </div>

              <div className="flex items-center gap-2" data-testid="badge-preview-4">
                <span className="text-[10px] text-muted-foreground w-3">④</span>
                <span className="inline-flex flex-col items-center">
                  <span className="text-[10px] font-semibold text-emerald-400">V</span>
                  <span className="w-4 h-[2px] rounded-full bg-emerald-400 mt-0.5" />
                </span>
                <span className="inline-flex flex-col items-center">
                  <span className="text-[10px] font-semibold text-violet-400">R</span>
                  <span className="w-4 h-[2px] rounded-full bg-violet-400 mt-0.5" />
                </span>
                <span className="inline-flex flex-col items-center">
                  <span className="text-[10px] font-semibold text-amber-400">D</span>
                  <span className="w-4 h-[2px] rounded-full bg-amber-400 mt-0.5" />
                </span>
                <span className="inline-flex flex-col items-center">
                  <span className="text-[10px] font-semibold text-rose-400">H</span>
                  <span className="w-4 h-[2px] rounded-full bg-rose-400 mt-0.5" />
                </span>
                <span className="text-[9px] text-muted-foreground/70 ml-auto">밑줄</span>
              </div>

              <div className="flex items-center gap-2" data-testid="badge-preview-5">
                <span className="text-[10px] text-muted-foreground w-3">⑤</span>
                <span className="inline-flex items-center justify-center h-5 px-2 rounded-md text-[10px] font-bold text-white shadow-sm bg-gradient-to-r from-emerald-500 to-teal-400">V</span>
                <span className="inline-flex items-center justify-center h-5 px-2 rounded-md text-[10px] font-bold text-white shadow-sm bg-gradient-to-r from-violet-500 to-purple-400">R</span>
                <span className="inline-flex items-center justify-center h-5 px-2 rounded-md text-[10px] font-bold text-white shadow-sm bg-gradient-to-r from-amber-500 to-orange-400">D</span>
                <span className="inline-flex items-center justify-center h-5 px-2 rounded-md text-[10px] font-bold text-white shadow-sm bg-gradient-to-r from-rose-500 to-pink-400">H</span>
                <span className="text-[9px] text-muted-foreground/70 ml-auto">그라데이션</span>
              </div>

            </div>
          </div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-1">
        <Link href="/product-info">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs"
            data-testid="button-product-info"
          >
            <Info className="w-3.5 h-3.5 mr-2" />
            제품 소개
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs"
          onClick={onAnalysisOpen}
          data-testid="button-spatial-analysis"
        >
          <Cpu className="w-3.5 h-3.5 mr-2" />
          공간 분석
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs"
          data-testid="button-export-data"
        >
          <Download className="w-3.5 h-3.5 mr-2" />
          데이터 내보내기
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs"
          onClick={onSettingsOpen}
          data-testid="button-open-settings"
        >
          <Settings2 className="w-3.5 h-3.5 mr-2" />
          시스템 설정
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
