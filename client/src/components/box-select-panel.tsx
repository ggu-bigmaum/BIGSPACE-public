import { useState, useEffect } from "react";
import type { Layer } from "@shared/schema";
import { X, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BoxSelectPanelProps {
  layer: Layer;
  bbox: [number, number, number, number];
  onClose: () => void;
}

export function BoxSelectPanel({ layer, bbox, onClose }: BoxSelectPanelProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ count: number; features: { id: string; lng: number; lat: number; properties: any }[] } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/layers/${layer.id}/features-in-bbox?bbox=${bbox.join(",")}&limit=500`
        );
        const result = await res.json();
        setData(result);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [layer.id, bbox[0], bbox[1], bbox[2], bbox[3]]);

  const propKeys = data?.features?.length
    ? Object.keys(data.features[0].properties || {}).filter(k => !k.startsWith("_"))
    : [];

  const handleExportCSV = () => {
    if (!data?.features?.length) return;
    const headers = ["lng", "lat", ...propKeys];
    const rows = data.features.map(f => [
      f.lng,
      f.lat,
      ...propKeys.map(k => String(f.properties?.[k] ?? "")),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${layer.name}_선택영역.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[520px] max-h-[60vh] bg-card/95 backdrop-blur-md border border-card-border rounded-lg shadow-xl flex flex-col"
      data-testid="panel-box-select"
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-card-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold" data-testid="text-box-select-title">영역 선택 결과</h3>
          {data && (
            <span className="text-xs text-muted-foreground" data-testid="text-box-select-count">
              {data.count.toLocaleString()}건
              {data.count > 500 && ` (500건 표시)`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {data?.features?.length ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExportCSV}
              className="h-7 px-2 text-xs"
              data-testid="button-export-csv"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              CSV
            </Button>
          ) : null}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
            data-testid="button-close-box-select"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-auto flex-1">
        {loading && (
          <div className="flex items-center justify-center py-8" data-testid="box-select-loading">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">조회 중...</span>
          </div>
        )}

        {!loading && data && data.features.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground" data-testid="box-select-empty">
            선택 영역에 데이터가 없습니다
          </div>
        )}

        {!loading && data && data.features.length > 0 && (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 sticky top-0">
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">#</th>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">경도</th>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">위도</th>
                {propKeys.slice(0, 5).map(k => (
                  <th key={k} className="text-left px-3 py-1.5 font-medium text-muted-foreground truncate max-w-[100px]">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.features.map((f, i) => (
                <tr
                  key={f.id}
                  className="border-b border-card-border/30 hover:bg-muted/30 transition-colors"
                  data-testid={`row-feature-${i}`}
                >
                  <td className="px-3 py-1 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-1 font-mono">{f.lng.toFixed(5)}</td>
                  <td className="px-3 py-1 font-mono">{f.lat.toFixed(5)}</td>
                  {propKeys.slice(0, 5).map(k => (
                    <td key={k} className="px-3 py-1 truncate max-w-[100px]">{String(f.properties?.[k] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-4 py-2 border-t border-card-border text-[10px] text-muted-foreground">
        범위: {bbox[0].toFixed(4)}, {bbox[1].toFixed(4)} ~ {bbox[2].toFixed(4)}, {bbox[3].toFixed(4)}
      </div>
    </div>
  );
}