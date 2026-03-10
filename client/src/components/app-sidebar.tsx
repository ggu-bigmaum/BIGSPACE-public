import { useState, useEffect } from "react";
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

const BADGE_COLOR_SOLID: Record<string, string> = {
  VECTOR: "bg-emerald-500", RASTER: "bg-violet-500", DEM: "bg-amber-500", HEATMAP: "bg-rose-500",
};
const BADGE_COLOR_LIGHT: Record<string, string> = {
  VECTOR: "bg-emerald-500/15 text-emerald-500 border-emerald-500/25",
  RASTER: "bg-violet-500/15 text-violet-500 border-violet-500/25",
  DEM: "bg-amber-500/15 text-amber-500 border-amber-500/25",
  HEATMAP: "bg-rose-500/15 text-rose-500 border-rose-500/25",
};
const BADGE_COLOR_TEXT: Record<string, string> = {
  VECTOR: "text-emerald-400", RASTER: "text-violet-400", DEM: "text-amber-400", HEATMAP: "text-rose-400",
};
const BADGE_COLOR_DOT: Record<string, string> = {
  VECTOR: "bg-emerald-400", RASTER: "bg-violet-400", DEM: "bg-amber-400", HEATMAP: "bg-rose-400",
};
const BADGE_GRADIENT: Record<string, string> = {
  VECTOR: "from-emerald-500 to-teal-400", RASTER: "from-violet-500 to-purple-400",
  DEM: "from-amber-500 to-orange-400", HEATMAP: "from-rose-500 to-pink-400",
};
const BADGE_SHORT: Record<string, string> = { VECTOR: "V", RASTER: "R", DEM: "D", HEATMAP: "H" };
const BADGE_KO: Record<string, string> = { VECTOR: "벡터", RASTER: "래스터", DEM: "DEM", HEATMAP: "히트맵" };
const BADGE_TOOLTIP: Record<string, string> = {
  VECTOR: "Vector Data Source", RASTER: "Raster Data Source", DEM: "Digital Elevation Model", HEATMAP: "Heatmap Layer",
};

export function AppSidebar({
  onLayerToggle,
  onLayerSelect,
  onAddLayer,
  onSettingsOpen,
  onAnalysisOpen,
  selectedLayerId,
}: AppSidebarProps) {
  const { toast } = useToast();
  const [badgeStyle, setBadgeStyle] = useState(() => localStorage.getItem("layerBadgeStyle") || "dot");

  useEffect(() => {
    const handler = (e: Event) => setBadgeStyle((e as CustomEvent).detail);
    window.addEventListener("badgeStyleChange", handler);
    return () => window.removeEventListener("badgeStyleChange", handler);
  }, []);

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

  return (
    <Sidebar>
      <SidebarHeader className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" data-testid="text-app-title">GIS 업무 솔루션</h2>
              <p className="text-[10px] text-muted-foreground" data-testid="text-app-version">v1.0 - Enterprise Edition</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/product-info">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      data-testid="button-product-info"
                    >
                      <Info className="w-4 h-4" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">제품 소개</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onAnalysisOpen}
                    data-testid="button-spatial-analysis"
                  >
                    <Cpu className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">공간 분석</TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
                                        <span data-testid={`badge-layer-type-${layer.id}`} className="scale-[0.7] origin-left inline-flex">
                                          {badgeStyle === "pill" && (
                                            <span className={`inline-flex items-center justify-center h-4 px-1.5 rounded-full ${BADGE_COLOR_SOLID[typeBadge]} text-white text-[9px] font-bold shadow-sm`}>
                                              {BADGE_SHORT[typeBadge]}
                                            </span>
                                          )}
                                          {badgeStyle === "icon" && (
                                            <span className={`inline-flex items-center gap-0.5 h-4 px-1 rounded-md text-[9px] font-semibold border ${BADGE_COLOR_LIGHT[typeBadge]}`}>
                                              <Layers className="w-2.5 h-2.5" />{BADGE_SHORT[typeBadge]}
                                            </span>
                                          )}
                                          {badgeStyle === "dot" && (
                                            <span className={`inline-flex items-center gap-1 text-[9px] font-medium ${BADGE_COLOR_TEXT[typeBadge]}`}>
                                              <span className={`w-1.5 h-1.5 rounded-full ${BADGE_COLOR_DOT[typeBadge]}`} />{BADGE_KO[typeBadge]}
                                            </span>
                                          )}
                                          {badgeStyle === "underline" && (
                                            <span className="inline-flex flex-col items-center">
                                              <span className={`text-[9px] font-semibold ${BADGE_COLOR_TEXT[typeBadge]}`}>{BADGE_SHORT[typeBadge]}</span>
                                              <span className={`w-3 h-[2px] rounded-full ${BADGE_COLOR_DOT[typeBadge]} mt-0.5`} />
                                            </span>
                                          )}
                                          {badgeStyle === "gradient" && (
                                            <span className={`inline-flex items-center justify-center h-4 px-1.5 rounded-md text-[9px] font-bold text-white shadow-sm bg-gradient-to-r ${BADGE_GRADIENT[typeBadge]}`}>
                                              {BADGE_SHORT[typeBadge]}
                                            </span>
                                          )}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom" className="text-xs">
                                        {BADGE_TOOLTIP[typeBadge] || typeBadge}
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

      </SidebarContent>

      <Separator />
      <SidebarFooter className="p-2 flex flex-row items-center justify-center gap-1">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                data-testid="button-export-data"
              >
                <Download className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">데이터 내보내기</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onSettingsOpen}
                data-testid="button-open-settings"
              >
                <Settings2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">시스템 설정</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarFooter>
    </Sidebar>
  );
}
