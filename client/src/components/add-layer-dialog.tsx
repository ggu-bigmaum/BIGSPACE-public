import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LAYER_PALETTE, getNextColor } from "@/lib/colorPalette";
import type { Layer } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Plus, Loader2, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AddLayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddLayerDialog({ open, onOpenChange }: AddLayerDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("일반");
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [geometryType, setGeometryType] = useState("Point");
  const [renderMode, setRenderMode] = useState("auto");
  const [featureLimit, setFeatureLimit] = useState("2000");
  const [minZoom, setMinZoom] = useState("15");
  const [strokeColor, setStrokeColor] = useState("#0d9488");
  const [fillColor, setFillColor] = useState("#0d948850");
  const [geojsonInput, setGeojsonInput] = useState("");
  const [activeTab, setActiveTab] = useState("empty");

  const { data: layers = [] } = useQuery<Layer[]>({
    queryKey: ["/api/layers"],
  });

  const existingCategories = [...new Set(layers.map((l) => l.category || "일반"))].sort();

  useEffect(() => {
    if (open) {
      const existing = layers.map((l) => l.strokeColor);
      const next = getNextColor(existing);
      setStrokeColor(next.strokeColor);
      setIsNewCategory(false);
      setNewCategoryInput("");
      if (existingCategories.length > 0) {
        setCategory(existingCategories[0]);
      }
      setFillColor(next.fillColor);
    }
  }, [open, layers]);

  const createLayerMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/layers", data);
      return res.json();
    },
    onSuccess: async (layer) => {
      if (geojsonInput.trim() && activeTab === "geojson") {
        try {
          const parsed = JSON.parse(geojsonInput);
          const featuresToUpload = parsed.type === "FeatureCollection"
            ? parsed.features
            : parsed.type === "Feature"
              ? [parsed]
              : [{ type: "Feature", geometry: parsed, properties: {} }];

          await apiRequest("POST", `/api/layers/${layer.id}/features`, featuresToUpload);
          toast({ title: "레이어가 생성되었습니다", description: `${featuresToUpload.length}개 피처가 가져와졌습니다` });
        } catch (e: any) {
          toast({ title: "레이어 생성 완료", description: "GeoJSON 가져오기 실패: " + e.message, variant: "destructive" });
        }
      } else {
        toast({ title: "레이어 생성 완료", description: `"${layer.name}" 레이어가 준비되었습니다` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/layers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "오류", description: e.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setCategory("일반");
    setIsNewCategory(false);
    setNewCategoryInput("");
    setGeometryType("Point");
    setRenderMode("auto");
    setFeatureLimit("2000");
    setMinZoom("15");
    setStrokeColor("#0d9488");
    setFillColor("#0d948850");
    setGeojsonInput("");
    setActiveTab("empty");
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: "이름을 입력해주세요", variant: "destructive" });
      return;
    }
    createLayerMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      category: (isNewCategory ? newCategoryInput.trim() : category.trim()) || "일반",
      geometryType,
      renderMode,
      featureLimit: parseInt(featureLimit),
      minZoomForFeatures: parseInt(minZoom),
      strokeColor,
      fillColor,
    });
  };

  const selectPaletteColor = (stroke: string, fill: string) => {
    setStrokeColor(stroke);
    setFillColor(fill);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>새 레이어 추가</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>카테고리</Label>
              {existingCategories.length > 0 && !isNewCategory ? (
                <div className="flex items-center gap-2">
                  <Select value={category} onValueChange={(val) => {
                    if (val === "__new__") {
                      setIsNewCategory(true);
                      setNewCategoryInput("");
                    } else {
                      setCategory(val);
                    }
                  }}>
                    <SelectTrigger className="flex-1" data-testid="select-layer-category">
                      <SelectValue placeholder="카테고리 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                      <SelectItem value="__new__">+ 새 카테고리</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    value={isNewCategory ? newCategoryInput : category}
                    onChange={(e) => {
                      if (isNewCategory) {
                        setNewCategoryInput(e.target.value);
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                    placeholder="새 카테고리 이름 입력"
                    data-testid="input-new-category"
                    className="flex-1"
                  />
                  {existingCategories.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8 px-2 shrink-0"
                      onClick={() => {
                        setIsNewCategory(false);
                        setCategory(existingCategories[0]);
                      }}
                      data-testid="button-cancel-new-category"
                    >
                      기존 선택
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <Label htmlFor="layer-name">레이어 이름</Label>
              <Input
                id="layer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 공공시설물"
                data-testid="input-layer-name"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="layer-desc">설명</Label>
              <Input
                id="layer-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="레이어에 대한 설명 (선택사항)"
                data-testid="input-layer-description"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>기하 타입</Label>
              <Select value={geometryType} onValueChange={setGeometryType}>
                <SelectTrigger data-testid="select-geometry-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Point">Point</SelectItem>
                  <SelectItem value="LineString">LineString</SelectItem>
                  <SelectItem value="Polygon">Polygon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>렌더 모드</Label>
              <Select value={renderMode} onValueChange={setRenderMode}>
                <SelectTrigger data-testid="select-render-mode">
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>피처 제한</Label>
              <Input
                type="number"
                value={featureLimit}
                onChange={(e) => setFeatureLimit(e.target.value)}
                data-testid="input-feature-limit"
              />
            </div>
            <div>
              <Label>상세 줌 레벨</Label>
              <Input
                type="number"
                value={minZoom}
                onChange={(e) => setMinZoom(e.target.value)}
                min={0}
                max={20}
                data-testid="input-min-zoom"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>색상</Label>
            <div className="flex flex-wrap gap-1.5" data-testid="palette-swatches">
              {LAYER_PALETTE.map((color) => (
                <Tooltip key={color.strokeColor}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => selectPaletteColor(color.strokeColor, color.fillColor)}
                      className={`w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center ${
                        strokeColor === color.strokeColor
                          ? "border-foreground scale-110 shadow-sm"
                          : "border-transparent hover:border-muted-foreground/30 hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.strokeColor }}
                      data-testid={`palette-color-${color.label}`}
                    >
                      {strokeColor === color.strokeColor && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {color.label}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                  className="w-7 h-7 rounded border cursor-pointer"
                  data-testid="input-stroke-color"
                />
                <span className="text-[10px] text-muted-foreground">선</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={fillColor.slice(0, 7)}
                  onChange={(e) => setFillColor(e.target.value + "50")}
                  className="w-7 h-7 rounded border cursor-pointer"
                  data-testid="input-fill-color"
                />
                <span className="text-[10px] text-muted-foreground">채우기</span>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="empty" className="flex-1" data-testid="tab-empty">
                <Plus className="w-3.5 h-3.5 mr-1" />
                빈 레이어
              </TabsTrigger>
              <TabsTrigger value="geojson" className="flex-1" data-testid="tab-geojson">
                <Upload className="w-3.5 h-3.5 mr-1" />
                GeoJSON 가져오기
              </TabsTrigger>
            </TabsList>
            <TabsContent value="geojson" className="mt-2">
              <Textarea
                value={geojsonInput}
                onChange={(e) => setGeojsonInput(e.target.value)}
                placeholder='GeoJSON을 여기에 붙여넣으세요 (FeatureCollection, Feature, 또는 Geometry)...'
                className="font-mono text-xs min-h-[120px]"
                data-testid="textarea-geojson"
              />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} data-testid="button-cancel-layer">
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createLayerMutation.isPending}
            data-testid="button-create-layer"
          >
            {createLayerMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            레이어 생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
