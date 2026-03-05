import type { Layer } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, Map, Ruler, Settings2 } from "lucide-react";

interface FeatureInfoPanelProps {
  layer: Layer;
  bbox?: number[];
  zoom?: number;
}

export function FeatureInfoPanel({ layer, bbox, zoom }: FeatureInfoPanelProps) {
  const bboxStr = bbox ? bbox.join(",") : undefined;
  const { data, isLoading } = useQuery({
    queryKey: ["/api/layers", layer.id, "features", bboxStr],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (bboxStr) params.set("bbox", bboxStr);
      params.set("limit", "50");
      const res = await fetch(`/api/layers/${layer.id}/features?${params}`);
      return res.json();
    },
    enabled: !!layer.id,
  });

  return (
    <div className="absolute bottom-3 right-3 z-20 w-80">
      <Card className="bg-card/95 backdrop-blur-sm overflow-hidden">
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm border"
                style={{ backgroundColor: layer.fillColor, borderColor: layer.strokeColor }}
              />
              <h3 className="text-sm font-semibold truncate">{layer.name}</h3>
            </div>
            <Badge variant="secondary" className="text-[10px]">{layer.geometryType}</Badge>
          </div>

          {layer.description && (
            <p className="text-[11px] text-muted-foreground">{layer.description}</p>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded bg-muted/50">
              <Database className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xs font-semibold">{layer.featureCount.toLocaleString()}</div>
              <div className="text-[9px] text-muted-foreground">Features</div>
            </div>
            <div className="text-center p-2 rounded bg-muted/50">
              <Map className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xs font-semibold">EPSG:{layer.srid}</div>
              <div className="text-[9px] text-muted-foreground">SRID</div>
            </div>
            <div className="text-center p-2 rounded bg-muted/50">
              <Settings2 className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xs font-semibold capitalize">{layer.renderMode}</div>
              <div className="text-[9px] text-muted-foreground">Render</div>
            </div>
          </div>

          <Separator />

          <div className="space-y-1">
            <div className="text-[11px] font-medium mb-1">Performance Policy</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
              <span className="text-muted-foreground">Feature Limit</span>
              <span>{layer.featureLimit.toLocaleString()}</span>
              <span className="text-muted-foreground">Detail Zoom</span>
              <span>Z{layer.minZoomForFeatures}+</span>
              <span className="text-muted-foreground">Tile Enabled</span>
              <span>{layer.tileEnabled ? "Yes" : "No"}</span>
              <span className="text-muted-foreground">Tile Max Zoom</span>
              <span>Z{layer.tileMaxZoom}</span>
              <span className="text-muted-foreground">Opacity</span>
              <span>{Math.round(layer.opacity * 100)}%</span>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium">Features in View</span>
              {isLoading ? (
                <Skeleton className="w-8 h-4" />
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  {data?.returned || 0}{data?.limited ? "+" : ""}
                </Badge>
              )}
            </div>
            <ScrollArea className="max-h-[160px]">
              {isLoading ? (
                <div className="space-y-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : data?.features?.length > 0 ? (
                <div className="space-y-1">
                  {data.features.slice(0, 20).map((f: any, i: number) => (
                    <div key={i} className="text-[10px] px-2 py-1 rounded bg-muted/30 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: layer.strokeColor }} />
                      <span className="truncate">{f.properties?.name || f.id?.slice(0, 8) || `#${i + 1}`}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground text-center py-3">
                  No features in current view
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </Card>
    </div>
  );
}
