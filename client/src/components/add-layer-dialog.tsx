import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { COLOR_FAMILIES, getNextColor } from "@/lib/colorPalette";
import type { Layer } from "@shared/schema";
import proj4 from "proj4";
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
import { Upload, Plus, Loader2, FileText, Globe } from "lucide-react";

// ── 좌표계 정의 ──────────────────────────────────────────────
proj4.defs("EPSG:5179", "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs");
proj4.defs("EPSG:5181", "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs");
proj4.defs("EPSG:5174", "+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43");
proj4.defs("EPSG:32652", "+proj=utm +zone=52 +datum=WGS84 +units=m +no_defs");
proj4.defs("EPSG:3857", "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs");

const CRS_OPTIONS = [
  { value: "EPSG:4326",  label: "EPSG:4326 — WGS84 (GPS, 공공API)" },
  { value: "EPSG:5179",  label: "EPSG:5179 — 국토지리정보원 통합기준계" },
  { value: "EPSG:5181",  label: "EPSG:5181 — 중부원점 2010 (행안부·경찰청)" },
  { value: "EPSG:5174",  label: "EPSG:5174 — 중부원점 Bessel (구형 SHP/CAD)" },
  { value: "EPSG:32652", label: "EPSG:32652 — UTM Zone 52N (동부)" },
  { value: "EPSG:3857",  label: "EPSG:3857 — Web Mercator (웹 타일)" },
];

const LAT_HINTS = ["lat", "latitude", "위도", "y", "y좌표", "ycoord"];
const LNG_HINTS = ["lng", "lon", "longitude", "경도", "x", "x좌표", "xcoord"];

function detectLatLng(headers: string[]): { lat: string; lng: string } {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const lat = headers[lower.findIndex((h) => LAT_HINTS.some((hint) => h === hint))] ?? "";
  const lng = headers[lower.findIndex((h) => LNG_HINTS.some((hint) => h === hint))] ?? "";
  return { lat, lng };
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const first = lines[0];
  const delim = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
  const headers = first.split(delim).map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(delim).map((v) => v.trim().replace(/^["']|["']$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
  return { headers, rows };
}

function toWGS84(x: number, y: number, crs: string): [number, number] {
  if (crs === "EPSG:4326") return [x, y];
  const [lng, lat] = proj4(crs, "EPSG:4326", [x, y]);
  return [lng, lat];
}

function opacityToHex(pct: number): string {
  return Math.round((pct / 100) * 255).toString(16).padStart(2, "0");
}

// ── 색상 팔레트 컴포넌트 ──────────────────────────────────────
function ColorPalette({
  strokeColor,
  fillColor,
  fillOpacity,
  onStrokeChange,
  onFillChange,
  onOpacityChange,
}: {
  strokeColor: string;
  fillColor: string;
  fillOpacity: number;
  onStrokeChange: (c: string) => void;
  onFillChange: (c: string) => void;
  onOpacityChange: (n: number) => void;
}) {
  return (
    <div className="space-y-3">
      {/* 프리셋 팔레트 */}
      <div>
        <Label className="text-xs mb-2 block">프리셋 팔레트</Label>
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
          {COLOR_FAMILIES.map((family) => (
            <div key={family.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-20 shrink-0 truncate">{family.label}</span>
              <div className="flex flex-1 rounded overflow-hidden">
                {family.shades.map((shade, i) => {
                  const isSelected = strokeColor.toLowerCase() === shade.toLowerCase();
                  return (
                    <button
                      key={shade}
                      type="button"
                      style={{ backgroundColor: shade }}
                      className={`flex-1 h-6 transition-all ${
                        isSelected ? "ring-2 ring-inset ring-white/80 brightness-90 z-10 relative" : "hover:brightness-90"
                      }`}
                      onClick={() => { onStrokeChange(shade); onFillChange(shade); }}
                      title={shade}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 커스텀 색상 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">선 색상</span>
          <div className="flex items-center gap-1.5">
            <input type="color" value={strokeColor} onChange={(e) => onStrokeChange(e.target.value)}
              className="w-7 h-7 rounded border cursor-pointer shrink-0" />
            <Input value={strokeColor} onChange={(e) => onStrokeChange(e.target.value)}
              className="h-7 text-[11px] font-mono px-2" maxLength={7} />
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">채우기 색상</span>
          <div className="flex items-center gap-1.5">
            <input type="color" value={fillColor} onChange={(e) => onFillChange(e.target.value)}
              className="w-7 h-7 rounded border cursor-pointer shrink-0" />
            <Input value={fillColor} onChange={(e) => onFillChange(e.target.value)}
              className="h-7 text-[11px] font-mono px-2" maxLength={7} />
          </div>
        </div>
      </div>

      {/* 채우기 불투명도 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">채우기 불투명도</span>
          <span className="text-[10px] font-mono text-muted-foreground">{fillOpacity}%</span>
        </div>
        <input type="range" min={0} max={100} value={fillOpacity}
          onChange={(e) => onOpacityChange(Number(e.target.value))}
          className="w-full h-1.5 accent-primary cursor-pointer" />
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
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
  const [subCategory, setSubCategory] = useState("");
  const [geometryType, setGeometryType] = useState("Point");
  const [renderMode, setRenderMode] = useState("auto");
  const [featureLimit, setFeatureLimit] = useState("5000");
  const [minZoom, setMinZoom] = useState("17");
  const [strokeColor, setStrokeColor] = useState("#6366f1");
  const [fillColor, setFillColor] = useState("#6366f1");
  const [fillOpacity, setFillOpacity] = useState(32);
  const [geojsonInput, setGeojsonInput] = useState("");
  const [activeTab, setActiveTab] = useState("empty");

  // WMS/WFS
  const [wmsLayers, setWmsLayers] = useState("");
  const [wfsLayers, setWfsLayers] = useState("");

  // CSV
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvLatCol, setCsvLatCol] = useState("");
  const [csvLngCol, setCsvLngCol] = useState("");
  const [csvCrs, setCsvCrs] = useState("EPSG:4326");
  const [csvFileName, setCsvFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: layers = [] } = useQuery<Layer[]>({ queryKey: ["/api/layers"] });
  const existingCategories = Array.from(new Set(layers.map((l) => l.category || "일반"))).sort();

  useEffect(() => {
    if (open) {
      const existing = layers.map((l) => l.strokeColor);
      const next = getNextColor(existing);
      setStrokeColor(next.strokeColor);
      setFillColor(next.strokeColor);
      setIsNewCategory(false);
      setNewCategoryInput("");
      if (existingCategories.length > 0) setCategory(existingCategories[0]);
    }
  }, [open, layers]);

  const createLayerMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/layers", data);
      return res.json();
    },
    onSuccess: async (layer) => {
      if (activeTab === "geojson" && geojsonInput.trim()) {
        try {
          const parsed = JSON.parse(geojsonInput);
          const features = parsed.type === "FeatureCollection" ? parsed.features
            : parsed.type === "Feature" ? [parsed]
            : [{ type: "Feature", geometry: parsed, properties: {} }];
          await apiRequest("POST", `/api/layers/${layer.id}/features`, features);
          toast({ title: "레이어가 생성되었습니다", description: `${features.length}개 피처가 가져와졌습니다` });
        } catch (e: any) {
          toast({ title: "레이어 생성 완료", description: "GeoJSON 가져오기 실패: " + e.message, variant: "destructive" });
        }
      } else if (activeTab === "csv" && csvRows.length > 0) {
        try {
          const features = csvRows.map((row) => {
            const rawX = parseFloat(row[csvLngCol]);
            const rawY = parseFloat(row[csvLatCol]);
            if (isNaN(rawX) || isNaN(rawY)) return null;
            const [lng, lat] = toWGS84(rawX, rawY, csvCrs);
            const properties = { ...row };
            delete properties[csvLngCol];
            delete properties[csvLatCol];
            return { type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties };
          }).filter(Boolean);
          await apiRequest("POST", `/api/layers/${layer.id}/features`, features);
          toast({ title: "레이어가 생성되었습니다", description: `${features.length}개 피처가 가져와졌습니다` });
        } catch (e: any) {
          toast({ title: "레이어 생성 완료", description: "CSV 변환 실패: " + e.message, variant: "destructive" });
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
    setName(""); setDescription(""); setCategory("일반");
    setIsNewCategory(false); setNewCategoryInput("");
    setGeometryType("Point"); setRenderMode("auto");
    setFeatureLimit("5000"); setMinZoom("17");
    setStrokeColor("#6366f1"); setFillColor("#6366f1"); setFillOpacity(32);
    setGeojsonInput(""); setActiveTab("empty");
    setWmsLayers(""); setWfsLayers("");
    setCsvHeaders([]); setCsvRows([]); setCsvLatCol(""); setCsvLngCol("");
    setCsvCrs("EPSG:4326"); setCsvFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: "이름을 입력해주세요", variant: "destructive" }); return;
    }
    if (activeTab === "csv") {
      if (csvRows.length === 0) { toast({ title: "CSV 파일을 업로드해주세요", variant: "destructive" }); return; }
      if (!csvLatCol || !csvLngCol) { toast({ title: "위도·경도 컬럼을 선택해주세요", variant: "destructive" }); return; }
    }
    if (activeTab === "wms" && !wmsLayers.trim()) {
      toast({ title: "WMS 레이어명을 입력해주세요", variant: "destructive" }); return;
    }
    if (activeTab === "wfs" && !wfsLayers.trim()) {
      toast({ title: "WFS 타입명을 입력해주세요", variant: "destructive" }); return;
    }

    const isService = activeTab === "wms" || activeTab === "wfs";
    createLayerMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      category: (isNewCategory ? newCategoryInput.trim() : category.trim()) || "일반",
      subCategory: subCategory.trim() || undefined,
      geometryType: activeTab === "csv" ? "Point" : geometryType,
      renderMode: isService ? "tile" : renderMode,
      featureLimit: parseInt(featureLimit),
      minZoomForFeatures: parseInt(minZoom),
      strokeColor,
      fillColor: fillColor + opacityToHex(fillOpacity),
      ...(activeTab === "wms" ? { wmsUrl: "/api/proxy/wms", wmsLayers: wmsLayers.trim() } : {}),
      ...(activeTab === "wfs" ? { wfsUrl: "/api/proxy/wfs", wfsLayers: wfsLayers.trim() } : {}),
    });
  };

  const handleCSVFile = (file: File) => {
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvRows(rows);
      const detected = detectLatLng(headers);
      setCsvLatCol(detected.lat || headers[1] || "");
      setCsvLngCol(detected.lng || headers[0] || "");
    };
    reader.readAsText(file, "utf-8");
  };

  const isService = activeTab === "wms" || activeTab === "wfs";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto top-[8%] translate-y-0">
        <DialogHeader>
          <DialogTitle>새 레이어 추가</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>카테고리</Label>
              {existingCategories.length > 0 && !isNewCategory ? (
                <Select value={category} onValueChange={(val) => {
                  if (val === "__new__") { setIsNewCategory(true); setNewCategoryInput(""); }
                  else setCategory(val);
                }}>
                  <SelectTrigger data-testid="select-layer-category"><SelectValue placeholder="카테고리 선택" /></SelectTrigger>
                  <SelectContent>
                    {existingCategories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    <SelectItem value="__new__">+ 새 카테고리</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2">
                  <Input value={isNewCategory ? newCategoryInput : category}
                    onChange={(e) => { if (isNewCategory) setNewCategoryInput(e.target.value); else setCategory(e.target.value); }}
                    placeholder="새 카테고리 이름 입력" data-testid="input-new-category" className="flex-1" />
                  {existingCategories.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" className="text-xs h-8 px-2 shrink-0"
                      onClick={() => { setIsNewCategory(false); setCategory(existingCategories[0]); }}
                      data-testid="button-cancel-new-category">기존 선택</Button>
                  )}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <Label htmlFor="layer-name">레이어 이름</Label>
              <Input id="layer-name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="예: 용도지역지구" data-testid="input-layer-name" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="layer-desc">설명</Label>
              <Input id="layer-desc" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="레이어에 대한 설명 (선택사항)" data-testid="input-layer-description" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="layer-subcat">중분류 (선택)</Label>
              <Input id="layer-subcat" value={subCategory} onChange={(e) => setSubCategory(e.target.value)}
                placeholder="예: 용도지역" data-testid="input-layer-subcategory" />
            </div>
          </div>

          {/* 데이터 소스 탭 — 상단 배치 */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="empty" className="flex-1" data-testid="tab-empty">
                <Plus className="w-3.5 h-3.5 mr-1" />빈 레이어
              </TabsTrigger>
              <TabsTrigger value="geojson" className="flex-1" data-testid="tab-geojson">
                <Upload className="w-3.5 h-3.5 mr-1" />GeoJSON
              </TabsTrigger>
              <TabsTrigger value="csv" className="flex-1" data-testid="tab-csv">
                <FileText className="w-3.5 h-3.5 mr-1" />CSV
              </TabsTrigger>
              <TabsTrigger value="wms" className="flex-1" data-testid="tab-wms">
                <Globe className="w-3.5 h-3.5 mr-1" />WMS
              </TabsTrigger>
              <TabsTrigger value="wfs" className="flex-1" data-testid="tab-wfs">
                <Globe className="w-3.5 h-3.5 mr-1" />WFS
              </TabsTrigger>
            </TabsList>

            <TabsContent value="empty" className="mt-2 h-[148px] flex items-start">
              <p className="text-xs text-muted-foreground">빈 레이어를 만들고 나중에 피처를 추가합니다.</p>
            </TabsContent>

            <TabsContent value="geojson" className="mt-2 h-[148px]">
              <Textarea value={geojsonInput} onChange={(e) => setGeojsonInput(e.target.value)}
                placeholder="GeoJSON을 여기에 붙여넣으세요 (FeatureCollection, Feature, 또는 Geometry)..."
                className="font-mono text-xs h-full resize-none" data-testid="textarea-geojson" />
            </TabsContent>

            <TabsContent value="csv" className="mt-2 h-[148px] space-y-3 overflow-y-auto">
              <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSVFile(f); }}
                data-testid="input-csv-file" />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-1.5 py-4 border-2 border-dashed border-border rounded-md text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors">
                <Upload className="w-5 h-5" />
                {csvFileName
                  ? <span className="text-foreground font-medium text-xs">{csvFileName} ({csvRows.length}행)</span>
                  : <span>CSV 파일 클릭하여 업로드</span>}
                <span className="text-[10px]">콤마 · 탭 · 세미콜론 구분자 자동 감지</span>
              </button>

              {csvHeaders.length > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">경도(X) 컬럼</Label>
                      <Select value={csvLngCol} onValueChange={setCsvLngCol}>
                        <SelectTrigger className="h-8 text-xs" data-testid="select-csv-lng"><SelectValue placeholder="선택" /></SelectTrigger>
                        <SelectContent>{csvHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">위도(Y) 컬럼</Label>
                      <Select value={csvLatCol} onValueChange={setCsvLatCol}>
                        <SelectTrigger className="h-8 text-xs" data-testid="select-csv-lat"><SelectValue placeholder="선택" /></SelectTrigger>
                        <SelectContent>{csvHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">좌표계</Label>
                    <Select value={csvCrs} onValueChange={setCsvCrs}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-csv-crs"><SelectValue /></SelectTrigger>
                      <SelectContent>{CRS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="wms" className="mt-2 h-[148px] space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md text-[10px] text-muted-foreground">
                <Globe className="w-3.5 h-3.5 shrink-0" />
                VWorld WMS 프록시 — API 키는 서버에서 자동 주입됩니다
              </div>
              <div>
                <Label className="text-xs">레이어명 (LAYERS 파라미터)</Label>
                <Input value={wmsLayers} onChange={(e) => setWmsLayers(e.target.value)}
                  placeholder="예: lp_pa_cbnd_bubun" className="text-xs" data-testid="input-wms-layers" />
                <p className="text-[10px] text-muted-foreground mt-1">여러 레이어는 쉼표로 구분 (예: layer1,layer2)</p>
              </div>
            </TabsContent>

            <TabsContent value="wfs" className="mt-2 h-[148px] space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md text-[10px] text-muted-foreground">
                <Globe className="w-3.5 h-3.5 shrink-0" />
                VWorld WFS 프록시 — API 키는 서버에서 자동 주입됩니다
              </div>
              <div>
                <Label className="text-xs">타입명 (TypeName 파라미터)</Label>
                <Input value={wfsLayers} onChange={(e) => setWfsLayers(e.target.value)}
                  placeholder="예: lp_pa_cbnd_bubun" className="text-xs" data-testid="input-wfs-layers" />
              </div>
            </TabsContent>
          </Tabs>

          {/* 렌더링 옵션 — WMS/WFS 숨김 */}
          {!isService && (
            <div className="grid grid-cols-2 gap-3">
              {activeTab !== "csv" && (
                <>
                  <div>
                    <Label>기하 타입</Label>
                    <Select value={geometryType} onValueChange={setGeometryType}>
                      <SelectTrigger data-testid="select-geometry-type"><SelectValue /></SelectTrigger>
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
                      <SelectTrigger data-testid="select-render-mode"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">자동</SelectItem>
                        <SelectItem value="feature">피처</SelectItem>
                        <SelectItem value="tile">타일</SelectItem>
                        <SelectItem value="aggregate">집계</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {activeTab === "csv" && (
                <div>
                  <Label>렌더 모드</Label>
                  <Select value={renderMode} onValueChange={setRenderMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">자동</SelectItem>
                      <SelectItem value="feature">피처</SelectItem>
                      <SelectItem value="tile">타일</SelectItem>
                      <SelectItem value="aggregate">집계</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>피처 제한</Label>
                <Input type="number" value={featureLimit} onChange={(e) => setFeatureLimit(e.target.value)}
                  data-testid="input-feature-limit" />
              </div>
              <div>
                <Label>상세 줌 레벨</Label>
                <Input type="number" value={minZoom} onChange={(e) => setMinZoom(e.target.value)}
                  min={0} max={20} data-testid="input-min-zoom" />
              </div>
            </div>
          )}

          {/* 색상 — WMS/WFS 숨김 */}
          {!isService && (
            <ColorPalette
              strokeColor={strokeColor}
              fillColor={fillColor}
              fillOpacity={fillOpacity}
              onStrokeChange={setStrokeColor}
              onFillChange={setFillColor}
              onOpacityChange={setFillOpacity}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} data-testid="button-cancel-layer">취소</Button>
          <Button onClick={handleSubmit} disabled={createLayerMutation.isPending} data-testid="button-create-layer">
            {createLayerMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            레이어 생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
