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
  Layers, Plus, Map, Download, Settings2, Globe, ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AppSidebarProps {
  onLayerToggle?: (layerId: string, visible: boolean) => void;
  onLayerSelect?: (layerId: string | null) => void;
  onAddLayer?: () => void;
  onSettingsOpen?: () => void;
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
        <div className="px-4 pt-3 pb-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground" data-testid="text-workspace-label">활성 작업 공간</span>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 justify-between text-xs font-normal"
              data-testid="button-project-selector"
            >
              <span className="truncate">Project_Alpha_01</span>
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-project-manage"
            >
              관리
            </Button>
          </div>
        </div>

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
                layersData.map((layer) => {
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
                          className="mt-0.5 data-[state=checked]:bg-primary"
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
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 h-4 font-semibold tracking-wider border ${badgeClass} no-default-hover-elevate no-default-active-elevate`}
                              data-testid={`badge-layer-type-${layer.id}`}
                            >
                              {typeBadge}
                            </Badge>
                            <span className="text-[9px] text-muted-foreground">·</span>
                            <span className="text-[9px] text-muted-foreground" data-testid={`text-layer-size-${layer.id}`}>
                              {sizeLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                    </SidebarMenuItem>
                  );
                })
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

      <SidebarFooter className="p-3 space-y-1">
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
