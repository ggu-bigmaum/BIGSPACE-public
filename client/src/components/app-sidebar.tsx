import { useState, useEffect, useCallback, useRef } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Layers, Map, Download, Settings2, Globe, Info, Cpu,
  Siren, Landmark, Car, Building2, TreePine, Users, Package, Zap, Hash,
  Pencil, Trash2, Plus, Check,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { LAYER_PALETTE } from "@/lib/colorPalette";

interface AppSidebarProps {
  onLayerToggle?: (layerId: string, visible: boolean) => void;
  onLayerSelect?: (layerId: string | null) => void;
  onSettingsOpen?: () => void;
  onAnalysisOpen?: () => void;
  onAddLayer?: () => void;
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

function LayerEditSheet({
  layer,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: {
  layer: Layer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, updates: Partial<Layer>) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Partial<Layer>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) setDraft({});
  }, [open, layer?.id]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const merged = layer ? { ...layer, ...draft } : null;

  const debouncedUpdate = useCallback((field: string, value: any) => {
    if (!layer) return;
    setDraft(prev => ({ ...prev, [field]: value }));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDraft(prev => {
        const updates = { ...prev, [field]: value };
        onUpdate(layer.id, updates);
        return {};
      });
    }, 600);
  }, [layer, onUpdate]);

  const instantUpdate = useCallback((updates: Partial<Layer>) => {
    if (!layer) return;
    setDraft(prev => ({ ...prev, ...updates }));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onUpdate(layer.id, updates);
      setDraft({});
    }, 300);
  }, [layer, onUpdate]);

  const safeFloat = (val: string, fallback: number) => {
    const n = parseFloat(val);
    return isFinite(n) ? n : fallback;
  };
  const safeInt = (val: string, fallback: number) => {
    const n = parseInt(val);
    return isFinite(n) ? n : fallback;
  };

  if (!merged) return null;

  const isPoint = merged.geometryType === "Point" || merged.geometryType === "MultiPoint";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[340px] sm:w-[380px] overflow-y-auto p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <div
              className="w-5 h-5 rounded border flex-shrink-0"
              style={{ backgroundColor: merged.fillColor, borderColor: merged.strokeColor }}
            />
            {merged.name}
          </SheetTitle>
          <p className="text-[11px] text-muted-foreground">
            {merged.geometryType} · 피처 {(merged.featureCount ?? 0).toLocaleString()}개
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">기본 정보</h3>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">레이어 이름</Label>
                <Input
                  className="h-8 text-xs mt-1"
                  defaultValue={layer?.name}
                  key={`name-${layer?.id}`}
                  onChange={(e) => debouncedUpdate("name", e.target.value)}
                  data-testid={`input-edit-name-${layer?.id}`}
                />
              </div>
              <div>
                <Label className="text-xs">설명</Label>
                <Input
                  className="h-8 text-xs mt-1"
                  defaultValue={layer?.description ?? ""}
                  key={`desc-${layer?.id}`}
                  onChange={(e) => debouncedUpdate("description", e.target.value)}
                  data-testid={`input-edit-desc-${layer?.id}`}
                />
              </div>
              <div>
                <Label className="text-xs">카테고리</Label>
                <Input
                  className="h-8 text-xs mt-1"
                  defaultValue={layer?.category}
                  key={`cat-${layer?.id}`}
                  onChange={(e) => debouncedUpdate("category", e.target.value || "일반")}
                  data-testid={`input-edit-category-${layer?.id}`}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">색상 · 스타일</h3>
            <div className="flex flex-wrap gap-1.5" data-testid={`palette-swatches-edit-${layer?.id}`}>
              {LAYER_PALETTE.map((color) => (
                <TooltipProvider key={color.strokeColor} delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => instantUpdate({ strokeColor: color.strokeColor, fillColor: color.fillColor })}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          merged.strokeColor === color.strokeColor
                            ? "border-foreground scale-110 shadow-sm"
                            : "border-transparent hover:border-muted-foreground/40 hover:scale-105"
                        }`}
                        style={{ backgroundColor: color.strokeColor }}
                        data-testid={`palette-edit-${color.label}-${layer?.id}`}
                      >
                        {merged.strokeColor === color.strokeColor && <Check className="w-2.5 h-2.5 text-white" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">{color.label}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={merged.strokeColor}
                  onChange={(e) => instantUpdate({ strokeColor: e.target.value })}
                  className="w-7 h-7 rounded border cursor-pointer"
                  data-testid={`input-edit-stroke-color-${layer?.id}`}
                />
                <span className="text-xs text-muted-foreground">선 색상</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={(merged.fillColor ?? "#0d9488").slice(0, 7)}
                  onChange={(e) => instantUpdate({ fillColor: e.target.value + "50" })}
                  className="w-7 h-7 rounded border cursor-pointer"
                  data-testid={`input-edit-fill-color-${layer?.id}`}
                />
                <span className="text-xs text-muted-foreground">채우기</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">불투명도</Label>
                <span className="text-[10px] text-muted-foreground">{Math.round((merged.opacity ?? 1) * 100)}%</span>
              </div>
              <input
                type="range" min="0" max="1" step="0.05"
                value={merged.opacity ?? 1}
                onChange={(e) => debouncedUpdate("opacity", safeFloat(e.target.value, 1))}
                className="w-full h-2 accent-primary"
                data-testid={`range-edit-opacity-${layer?.id}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">선 두께</Label>
                <Input
                  type="number" min="0.5" max="10" step="0.5"
                  className="h-8 text-xs mt-1"
                  defaultValue={layer?.strokeWidth}
                  key={`sw-${layer?.id}`}
                  onChange={(e) => debouncedUpdate("strokeWidth", safeFloat(e.target.value, 2))}
                  data-testid={`input-edit-stroke-width-${layer?.id}`}
                />
              </div>
              {isPoint && (
                <div>
                  <Label className="text-xs">점 크기</Label>
                  <Input
                    type="number" min="1" max="30" step="1"
                    className="h-8 text-xs mt-1"
                    defaultValue={layer?.pointRadius}
                    key={`pr-${layer?.id}`}
                    onChange={(e) => debouncedUpdate("pointRadius", safeFloat(e.target.value, 6))}
                    data-testid={`input-edit-point-radius-${layer?.id}`}
                  />
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">렌더링 설정</h3>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">렌더링 모드</Label>
                <Select
                  value={merged.renderMode}
                  onValueChange={(v) => onUpdate(layer!.id, { renderMode: v })}
                >
                  <SelectTrigger className="h-8 text-xs mt-1" data-testid={`select-edit-render-mode-${layer?.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">자동</SelectItem>
                    <SelectItem value="feature">피처</SelectItem>
                    <SelectItem value="tile">타일</SelectItem>
                    <SelectItem value="aggregate">집계</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">피처 제한</Label>
                  <Input
                    type="number" min="100" max="50000" step="100"
                    className="h-8 text-xs mt-1"
                    defaultValue={layer?.featureLimit}
                    key={`fl-${layer?.id}`}
                    onChange={(e) => debouncedUpdate("featureLimit", safeInt(e.target.value, 5000))}
                    data-testid={`input-edit-feature-limit-${layer?.id}`}
                  />
                </div>
                <div>
                  <Label className="text-xs">상세 줌</Label>
                  <Input
                    type="number" min="0" max="22" step="1"
                    className="h-8 text-xs mt-1"
                    defaultValue={layer?.minZoomForFeatures}
                    key={`mz-${layer?.id}`}
                    onChange={(e) => debouncedUpdate("minZoomForFeatures", safeInt(e.target.value, 17))}
                    data-testid={`input-edit-min-zoom-${layer?.id}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="px-4 py-3 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="w-full h-8 text-xs"
                data-testid={`button-delete-layer-${layer?.id}`}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                레이어 삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>레이어를 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  <strong>"{layer?.name}"</strong> 레이어와 포함된 모든 피처 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    onDelete(layer!.id);
                    onOpenChange(false);
                  }}
                  data-testid={`button-confirm-delete-${layer?.id}`}
                >
                  삭제
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function AppSidebar({
  onLayerToggle,
  onLayerSelect,
  onSettingsOpen,
  onAnalysisOpen,
  onAddLayer,
  selectedLayerId,
}: AppSidebarProps) {
  const { toast } = useToast();
  const [badgeStyle, setBadgeStyle] = useState(() => localStorage.getItem("layerBadgeStyle") || "dot");
  const [editingLayer, setEditingLayer] = useState<Layer | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/layers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/layers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "레이어가 삭제되었습니다" });
    },
    onError: (e: any) => {
      toast({ title: "삭제 실패", description: e.message, variant: "destructive" });
    },
  });

  const handleEditOpen = (layer: Layer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLayer(layer);
    setEditSheetOpen(true);
  };

  return (
    <>
      <Sidebar>
        <SidebarHeader className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold" data-testid="text-app-title">BIGSPACE Public</h2>
                <p className="text-[10px] text-muted-foreground" data-testid="text-app-version">v1.3</p>
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
            <SidebarGroupLabel className="flex items-center justify-between px-2.5 py-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3 h-3" />
                레이어
              </span>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 rounded"
                      onClick={onAddLayer}
                      data-testid="button-add-layer-sidebar"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">레이어 추가</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </SidebarGroupLabel>
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

                    return categories.map((cat, catIndex) => (
                      <div key={cat}>
                        {categories.length > 1 && catIndex > 0 && (
                          <Separator className="my-1" />
                        )}
                        {categories.length > 1 && (
                          <div className={`flex items-center gap-1.5 px-2.5 pb-1 ${catIndex === 0 ? "pt-1" : "pt-2"}`} data-testid={`category-label-${cat}`}>
                            {(() => {
                              const iconMap: Record<string, typeof Siren> = {
                                "응급출동": Siren, "행정": Landmark, "교통": Car,
                                "인프라": Building2, "환경": TreePine, "인구": Users,
                                "물류": Package, "에너지": Zap,
                              };
                              const fallbackIcons = [Hash, Globe, Map, Layers];
                              const Icon = iconMap[cat] || fallbackIcons[cat.length % fallbackIcons.length];
                              return <Icon className="w-3 h-3 text-primary" />;
                            })()}
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
                                className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors ${isSelected ? "bg-accent" : "hover-elevate"}`}
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
                                  className="mt-0.5 h-4 w-7 data-[state=checked]:bg-primary [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3 flex-shrink-0"
                                  data-testid={`switch-toggle-visibility-${layer.id}`}
                                />
                                <div className="flex-1 min-w-0 flex items-center gap-1.5">
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
                                  <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                                    <span className={`text-[9px] text-muted-foreground group-hover:hidden`} data-testid={`text-layer-size-${layer.id}`}>
                                      {sizeLabel}
                                    </span>
                                    <div className="hidden group-hover:flex items-center gap-0.5">
                                      <TooltipProvider delayDuration={200}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                              onClick={(e) => handleEditOpen(layer, e)}
                                              data-testid={`button-edit-layer-${layer.id}`}
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent side="bottom" className="text-xs">레이어 편집</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      <AlertDialog>
                                        <TooltipProvider delayDuration={200}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <AlertDialogTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-5 w-5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                  onClick={(e) => e.stopPropagation()}
                                                  data-testid={`button-delete-layer-inline-${layer.id}`}
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </Button>
                                              </AlertDialogTrigger>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="text-xs">삭제</TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>레이어를 삭제하시겠습니까?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              <strong>"{layer.name}"</strong> 레이어와 모든 피처 데이터가 영구적으로 삭제됩니다.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>취소</AlertDialogCancel>
                                            <AlertDialogAction
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                deleteMutation.mutate(layer.id);
                                              }}
                                              data-testid={`button-confirm-delete-inline-${layer.id}`}
                                            >
                                              삭제
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                    <TooltipProvider delayDuration={300}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span data-testid={`badge-layer-type-${layer.id}`} className="scale-[0.7] origin-right inline-flex group-hover:hidden">
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
                      <p className="text-[10px] text-muted-foreground/60">+ 버튼으로 레이어를 추가하세요</p>
                    </div>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

        </SidebarContent>

        <Separator />
        <SidebarFooter className="p-2 flex flex-row items-center justify-end gap-1">
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

      <LayerEditSheet
        layer={editingLayer}
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        onUpdate={(id, updates) => updateMutation.mutate({ id, updates })}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </>
  );
}
