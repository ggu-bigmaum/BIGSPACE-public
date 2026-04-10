import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  SidebarFooter as SidebarFooterWrapper,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Layers, Map, Globe, Info, Cpu, CircleDot,
  Trash2, Plus, Check, PanelLeftClose, PanelLeft,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { LAYER_PALETTE } from "@/lib/colorPalette";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { LayerGroup } from "@/components/sidebar/LayerGroup";
import { LayerSearch } from "@/components/sidebar/LayerSearch";
import { SidebarFooterContent } from "@/components/sidebar/SidebarFooter";

// ────────────────────────────────────────────────────────────────────
// Props (unchanged public interface)
// ────────────────────────────────────────────────────────────────────

interface AppSidebarProps {
  onLayerToggle?: (layerId: string, visible: boolean) => void;
  onLayerSelect?: (layerId: string | null) => void;
  onSettingsOpen?: () => void;
  onAnalysisOpen?: () => void;
  onRadiusOpen?: () => void;
  onAddLayer?: () => void;
  selectedLayerId?: string | null;
}

// ────────────────────────────────────────────────────────────────────
// LayerEditSheet (kept as-is — complex edit panel)
// ────────────────────────────────────────────────────────────────────

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
            {merged.wmsUrl ? "WMS 외부 레이어" : `${merged.geometryType} · 피처 ${(merged.featureCount ?? 0).toLocaleString()}개`}
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
                <Label className="text-xs">카테고리 (대분류)</Label>
                <Input
                  className="h-8 text-xs mt-1"
                  defaultValue={layer?.category}
                  key={`cat-${layer?.id}`}
                  onChange={(e) => debouncedUpdate("category", e.target.value || "일반")}
                  data-testid={`input-edit-category-${layer?.id}`}
                />
              </div>
              <div>
                <Label className="text-xs">중분류 (선택)</Label>
                <Input
                  className="h-8 text-xs mt-1"
                  defaultValue={layer?.subCategory ?? ""}
                  key={`subcat-${layer?.id}`}
                  placeholder="예: 용도지역"
                  onChange={(e) => debouncedUpdate("subCategory", e.target.value || null)}
                  data-testid={`input-edit-subcategory-${layer?.id}`}
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
                        aria-label={color.label}
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

// ────────────────────────────────────────────────────────────────────
// Main sidebar component
// ────────────────────────────────────────────────────────────────────

export function AppSidebar({
  onLayerToggle,
  onLayerSelect,
  onSettingsOpen,
  onAnalysisOpen,
  onRadiusOpen,
  onAddLayer,
  selectedLayerId,
}: AppSidebarProps) {
  const { toast } = useToast();
  const { setOpenMobile, isMobile, toggleSidebar, open } = useSidebar();

  const closeMobileIfNeeded = useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

  const [editingLayer, setEditingLayer] = useState<Layer | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Data fetching ──────────────────────────────────────────────

  const { data: layersData, isLoading } = useQuery<Layer[]>({
    queryKey: ["/api/layers"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      await apiRequest("PATCH", `/api/layers/${id}`, updates);
    },
    onSuccess: async () => {
      // reorder가 진행 중이면 완료될 때까지 대기 후 invalidate
      if (reorderPromiseRef.current) await reorderPromiseRef.current.catch(() => {});
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

  // ── Drag reorder ───────────────────────────────────────────────

  const reorderPromiseRef = useRef<Promise<unknown> | null>(null);

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const p = apiRequest("PATCH", "/api/layers/reorder", { ids });
      reorderPromiseRef.current = p;
      await p;
      reorderPromiseRef.current = null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/layers"] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !layersData) return;

      const oldIndex = layersData.findIndex((l) => l.id === active.id);
      const newIndex = layersData.findIndex((l) => l.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(layersData, oldIndex, newIndex);
      // Optimistic: update query cache
      queryClient.setQueryData(["/api/layers"], reordered);
      // Persist
      reorderMutation.mutate(reordered.map((l) => l.id));
    },
    [layersData, reorderMutation],
  );

  // ── Callbacks for sub-components ───────────────────────────────

  const handleToggle = useCallback(
    (layerId: string, visible: boolean) => {
      // 낙관적 업데이트만 — invalidateQueries 안 탐 (순서 보존)
      queryClient.setQueryData(["/api/layers"], (old: Layer[] | undefined) =>
        old?.map((l) => (l.id === layerId ? { ...l, visible } : l)),
      );
      // fire-and-forget: 서버에 저장만, refetch 안 함
      apiRequest("PATCH", `/api/layers/${layerId}`, { visible }).catch(() => {
        // 실패 시 롤백
        queryClient.invalidateQueries({ queryKey: ["/api/layers"] });
      });
      onLayerToggle?.(layerId, visible);
    },
    [onLayerToggle],
  );

  const handleSelect = useCallback(
    (layerId: string | null) => {
      onLayerSelect?.(layerId);
      closeMobileIfNeeded();
    },
    [onLayerSelect, closeMobileIfNeeded],
  );

  const handleEditOpen = useCallback(
    (layer: Layer, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingLayer(layer);
      setEditSheetOpen(true);
    },
    [],
  );

  const handleDelete = useCallback(
    (layerId: string) => {
      deleteMutation.mutate(layerId);
    },
    [deleteMutation],
  );

  // ── Grouped + filtered layers ──────────────────────────────────

  const grouped = useMemo(() => {
    if (!layersData) return {};
    const q = searchQuery.toLowerCase();
    const filtered = q
      ? layersData.filter((l) => l.name.toLowerCase().includes(q))
      : layersData;

    return filtered.reduce<Record<string, Layer[]>>((acc, layer) => {
      const cat = layer.category || "기타";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(layer);
      return acc;
    }, {});
  }, [layersData, searchQuery]);

  const categories = Object.keys(grouped);
  const allLayerIds = useMemo(
    () => (layersData ?? []).map((l) => l.id),
    [layersData],
  );

  // ── Render ─────────────────────────────────────────────────────

  return (
    <>
      <Sidebar collapsible="icon">
        {/* Header */}
        <SidebarHeader className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:gap-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <h2 className="text-sm font-semibold" data-testid="text-app-title">BIGSPACE Public</h2>
                <p className="text-[10px] text-muted-foreground" data-testid="text-app-version">v0.9</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/product-info">
                      <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="button-product-info">
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
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => { onRadiusOpen?.(); closeMobileIfNeeded(); }}
                      data-testid="button-radius-search"
                    >
                      <CircleDot className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">반경 검색</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => { onAnalysisOpen?.(); closeMobileIfNeeded(); }}
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
          {/* 접기 버튼 — 모바일에서는 숨김 */}
          {!isMobile && (
            <button
              className="absolute -right-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={toggleSidebar}
              aria-label={open ? "사이드바 접기" : "사이드바 펼치기"}
            >
              {open
                ? <PanelLeftClose className="w-3 h-3" />
                : <PanelLeft className="w-3 h-3" />}
            </button>
          )}
        </SidebarHeader>

        <Separator />

        {/* Search — 접힌 상태에서 숨김 */}
        <div className="group-data-[collapsible=icon]:hidden">
          <LayerSearch value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Layer content */}
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
                      variant="ghost" size="icon" className="h-5 w-5 rounded"
                      onClick={() => { onAddLayer?.(); closeMobileIfNeeded(); }}
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={allLayerIds} strategy={verticalListSortingStrategy}>
                  <SidebarMenu>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <SidebarMenuItem key={i}>
                          <div className="px-2 py-2">
                            <Skeleton className="h-8 w-full" />
                          </div>
                        </SidebarMenuItem>
                      ))
                    ) : categories.length > 0 ? (
                      categories.map((cat, idx) => (
                        <SidebarMenuItem key={cat}>
                          {idx > 0 && <Separator className="my-1" />}
                          <LayerGroup
                            category={cat}
                            layers={grouped[cat]}
                            onToggle={handleToggle}
                            onEdit={handleEditOpen}
                            onDelete={handleDelete}
                          />
                        </SidebarMenuItem>
                      ))
                ) : (
                  <SidebarMenuItem>
                    <div className="px-3 py-4 text-center">
                      <Map className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                      {searchQuery ? (
                        <>
                          <p className="text-xs text-muted-foreground" data-testid="text-no-layers">
                            &ldquo;{searchQuery}&rdquo;에 맞는 레이어가 없습니다
                          </p>
                          <button
                            className="mt-2 text-[11px] text-primary hover:underline"
                            onClick={() => setSearchQuery("")}
                          >
                            × 검색 초기화
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground" data-testid="text-no-layers">레이어가 없습니다</p>
                          <p className="text-[10px] text-muted-foreground/60">+ 버튼으로 레이어를 추가하세요</p>
                        </>
                      )}
                    </div>
                  </SidebarMenuItem>
                )}
                  </SidebarMenu>
                </SortableContext>
              </DndContext>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <Separator />

        {/* Footer */}
        <SidebarFooterWrapper className="p-2 space-y-1">
          <SidebarFooterContent
            onSettingsOpen={onSettingsOpen}
            closeMobileIfNeeded={closeMobileIfNeeded}
          />
        </SidebarFooterWrapper>
      </Sidebar>

      {/* Layer edit sheet (side panel) */}
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
