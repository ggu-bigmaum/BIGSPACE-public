import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Upload, Plus, Loader2 } from "lucide-react";

interface AddLayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddLayerDialog({ open, onOpenChange }: AddLayerDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("일반");
  const [geometryType, setGeometryType] = useState("Point");
  const [renderMode, setRenderMode] = useState("auto");
  const [featureLimit, setFeatureLimit] = useState("2000");
  const [minZoom, setMinZoom] = useState("15");
  const [strokeColor, setStrokeColor] = useState("#3b82f6");
  const [fillColor, setFillColor] = useState("#3b82f680");
  const [geojsonInput, setGeojsonInput] = useState("");
  const [activeTab, setActiveTab] = useState("empty");

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
          toast({ title: "Layer created with features", description: `${featuresToUpload.length} features imported` });
        } catch (e: any) {
          toast({ title: "Layer created", description: "But GeoJSON import failed: " + e.message, variant: "destructive" });
        }
      } else {
        toast({ title: "Layer created", description: `"${layer.name}" is ready` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/layers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setCategory("일반");
    setGeometryType("Point");
    setRenderMode("auto");
    setFeatureLimit("2000");
    setMinZoom("15");
    setStrokeColor("#3b82f6");
    setFillColor("#3b82f680");
    setGeojsonInput("");
    setActiveTab("empty");
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    createLayerMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      category: category.trim() || "일반",
      geometryType,
      renderMode,
      featureLimit: parseInt(featureLimit),
      minZoomForFeatures: parseInt(minZoom),
      strokeColor,
      fillColor,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Layer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="layer-name">Layer Name</Label>
              <Input
                id="layer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Public Facilities"
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
            <div className="col-span-2">
              <Label htmlFor="layer-category">카테고리</Label>
              <Input
                id="layer-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="예: 인프라, 교통, 행정, 환경"
                data-testid="input-layer-category"
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
              <Label>Render Mode</Label>
              <Select value={renderMode} onValueChange={setRenderMode}>
                <SelectTrigger data-testid="select-render-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="tile">Tile</SelectItem>
                  <SelectItem value="aggregate">Aggregate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Feature Limit</Label>
              <Input
                type="number"
                value={featureLimit}
                onChange={(e) => setFeatureLimit(e.target.value)}
                data-testid="input-feature-limit"
              />
            </div>
            <div>
              <Label>Detail Zoom Level</Label>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Stroke Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer"
                  data-testid="input-stroke-color"
                />
                <Input value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="flex-1" />
              </div>
            </div>
            <div>
              <Label>Fill Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={fillColor.slice(0, 7)}
                  onChange={(e) => setFillColor(e.target.value + "80")}
                  className="w-8 h-8 rounded border cursor-pointer"
                  data-testid="input-fill-color"
                />
                <Input value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="flex-1" />
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="empty" className="flex-1" data-testid="tab-empty">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Empty Layer
              </TabsTrigger>
              <TabsTrigger value="geojson" className="flex-1" data-testid="tab-geojson">
                <Upload className="w-3.5 h-3.5 mr-1" />
                Import GeoJSON
              </TabsTrigger>
            </TabsList>
            <TabsContent value="geojson" className="mt-2">
              <Textarea
                value={geojsonInput}
                onChange={(e) => setGeojsonInput(e.target.value)}
                placeholder='Paste GeoJSON here (FeatureCollection, Feature, or Geometry)...'
                className="font-mono text-xs min-h-[120px]"
                data-testid="textarea-geojson"
              />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} data-testid="button-cancel-layer">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createLayerMutation.isPending}
            data-testid="button-create-layer"
          >
            {createLayerMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Layer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
