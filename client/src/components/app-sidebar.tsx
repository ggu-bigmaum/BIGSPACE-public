import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Layer, Basemap } from "@shared/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Layers, Plus, Eye, EyeOff, Circle, Route, Square, Trash2,
  Map, Database, Search, Activity, ChevronDown, ChevronRight, Settings2, Globe, Star,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface AppSidebarProps {
  onLayerToggle?: (layerId: string, visible: boolean) => void;
  onLayerSelect?: (layerId: string | null) => void;
  onAddLayer?: () => void;
  onToolSelect?: (tool: string) => void;
  onSettingsOpen?: () => void;
  selectedLayerId?: string | null;
  activeTool?: string;
}

const geomIcons: Record<string, any> = {
  Point: Circle,
  LineString: Route,
  Polygon: Square,
};

export function AppSidebar({
  onLayerToggle,
  onLayerSelect,
  onAddLayer,
  onToolSelect,
  onSettingsOpen,
  selectedLayerId,
  activeTool,
}: AppSidebarProps) {
  const { toast } = useToast();
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());

  const { data: layersData, isLoading } = useQuery<Layer[]>({
    queryKey: ["/api/layers"],
  });

  const { data: basemapList = [] } = useQuery<Basemap[]>({
    queryKey: ["/api/basemaps"],
  });

  const { data: stats } = useQuery<{ layerCount: number; totalFeatures: number }>({
    queryKey: ["/api/stats"],
  });

  const enabledBasemaps = basemapList.filter(b => b.enabled);

  const toggleBasemapMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      if (!enabled && enabledBasemaps.length <= 1) {
        throw new Error("최소 하나의 배경 지도가 활성화되어 있어야 합니다.");
      }
      await apiRequest("PATCH", `/api/basemaps/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/basemaps"] });
    },
    onError: (error: Error) => {
      toast({ title: "배경 지도 오류", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/layers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/layers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Layer deleted" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      await apiRequest("PATCH", `/api/layers/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/layers"] });
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedLayers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const tools = [
    { id: "select", label: "Select", icon: Search },
    { id: "radius", label: "Radius Search", icon: Activity },
    { id: "measure", label: "Measure", icon: Route },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">GIS Solution</h2>
            <p className="text-xs text-muted-foreground">Spatial Data Platform</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto scrollbar-none">
        <SidebarGroup>
          <div className="flex items-center justify-between gap-1 px-2">
            <SidebarGroupLabel className="px-0">
              <Layers className="w-3.5 h-3.5 mr-1.5" />
              Layers
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
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </SidebarMenuItem>
                ))
              ) : layersData && layersData.length > 0 ? (
                layersData.map((layer) => {
                  const GeomIcon = geomIcons[layer.geometryType] || Layers;
                  const isExpanded = expandedLayers.has(layer.id);
                  const isSelected = selectedLayerId === layer.id;

                  return (
                    <SidebarMenuItem key={layer.id}>
                      <div className={`rounded-md transition-colors ${isSelected ? "bg-accent" : ""}`}>
                        <div className="flex items-center gap-1 px-2 py-1.5">
                          <button
                            onClick={() => toggleExpand(layer.id)}
                            className="p-0.5 rounded hover-elevate"
                            data-testid={`button-expand-layer-${layer.id}`}
                          >
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => {
                              const newVisible = !layer.visible;
                              updateMutation.mutate({ id: layer.id, updates: { visible: newVisible } });
                              onLayerToggle?.(layer.id, newVisible);
                            }}
                            className="p-0.5"
                            data-testid={`button-toggle-visibility-${layer.id}`}
                          >
                            {layer.visible ? (
                              <Eye className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </button>
                          <div
                            className="w-3 h-3 rounded-sm border flex-shrink-0"
                            style={{ backgroundColor: layer.fillColor, borderColor: layer.strokeColor }}
                          />
                          <button
                            className="flex-1 text-left text-xs font-medium truncate px-1"
                            onClick={() => onLayerSelect?.(isSelected ? null : layer.id)}
                            data-testid={`button-select-layer-${layer.id}`}
                          >
                            {layer.name}
                          </button>
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                            {layer.featureCount.toLocaleString()}
                          </Badge>
                        </div>

                        {isExpanded && (
                          <div className="px-3 pb-2 space-y-2">
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <GeomIcon className="w-3 h-3" />
                              <span>{layer.geometryType}</span>
                              <span>EPSG:{layer.srid}</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">Opacity</span>
                                <span className="text-[10px] text-muted-foreground">{Math.round(layer.opacity * 100)}%</span>
                              </div>
                              <Slider
                                value={[layer.opacity * 100]}
                                min={0}
                                max={100}
                                step={5}
                                onValueChange={([v]) => {
                                  updateMutation.mutate({ id: layer.id, updates: { opacity: v / 100 } });
                                }}
                                data-testid={`slider-opacity-${layer.id}`}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              <div className="text-muted-foreground">Render</div>
                              <div className="capitalize">{layer.renderMode}</div>
                              <div className="text-muted-foreground">Detail Zoom</div>
                              <div>Z{layer.minZoomForFeatures}+</div>
                              <div className="text-muted-foreground">Limit</div>
                              <div>{layer.featureLimit.toLocaleString()}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full h-7 text-[11px] text-destructive"
                              onClick={() => deleteMutation.mutate(layer.id)}
                              data-testid={`button-delete-layer-${layer.id}`}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete Layer
                            </Button>
                          </div>
                        )}
                      </div>
                    </SidebarMenuItem>
                  );
                })
              ) : (
                <SidebarMenuItem>
                  <div className="px-3 py-4 text-center">
                    <Map className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">No layers yet</p>
                    <p className="text-[10px] text-muted-foreground/60">Click + to add a layer</p>
                  </div>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="mx-2" />

        <SidebarGroup>
          <SidebarGroupLabel>
            <Globe className="w-3.5 h-3.5 mr-1.5" />
            Background Maps
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {basemapList.map((bm) => (
                <SidebarMenuItem key={bm.id}>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <button
                      onClick={() => toggleBasemapMutation.mutate({ id: bm.id, enabled: !bm.enabled })}
                      className="p-0.5"
                      data-testid={`button-toggle-basemap-${bm.id}`}
                    >
                      {bm.enabled ? (
                        <Eye className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>
                    <span
                      className={`text-xs flex-1 truncate ${bm.enabled ? "" : "text-muted-foreground"}`}
                      data-testid={`text-basemap-name-${bm.id}`}
                    >
                      {bm.name}
                    </span>
                    {bm.isDefault && (
                      <Star className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    )}
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="mx-2" />

        <SidebarGroup>
          <SidebarGroupLabel>
            <Settings2 className="w-3.5 h-3.5 mr-1.5" />
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tools.map((tool) => (
                <SidebarMenuItem key={tool.id}>
                  <SidebarMenuButton
                    onClick={() => onToolSelect?.(tool.id)}
                    data-active={activeTool === tool.id}
                    className={activeTool === tool.id ? "bg-accent" : ""}
                    data-testid={`button-tool-${tool.id}`}
                  >
                    <tool.icon className="w-4 h-4" />
                    <span>{tool.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs h-8"
          onClick={onSettingsOpen}
          data-testid="button-open-settings"
        >
          <Settings2 className="w-3.5 h-3.5 mr-2" />
          설정
        </Button>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Database className="w-3 h-3" />
          <span>
            {stats ? `${stats.layerCount} layers, ${stats.totalFeatures.toLocaleString()} features` : "Loading..."}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
