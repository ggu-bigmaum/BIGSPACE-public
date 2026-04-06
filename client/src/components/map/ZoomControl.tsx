import { Plus, Minus } from "lucide-react";
import { formatCoordinate, getApproxScale } from "@/lib/mapUtils";

interface ZoomControlProps {
  zoom: number;
  cursorCoord: [number, number] | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ZoomControl({ zoom, cursorCoord, onZoomIn, onZoomOut }: ZoomControlProps) {
  return (
    <>
      {/* Zoom buttons — integrated vertical control */}
      <div className="absolute right-3 bottom-24 z-10 flex flex-col bg-background border border-border rounded-lg shadow-md overflow-hidden">
        <button
          className="p-2 hover:bg-accent transition-colors border-b border-border"
          onClick={onZoomIn}
          data-testid="button-zoom-in"
        >
          <Plus className="w-4 h-4 text-foreground" />
        </button>
        <div className="px-2 py-1 text-center text-[11px] font-mono text-muted-foreground tabular-nums bg-accent/30">
          Z{Math.round(zoom)}
        </div>
        <button
          className="p-2 hover:bg-accent transition-colors border-t border-border"
          onClick={onZoomOut}
          data-testid="button-zoom-out"
        >
          <Minus className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Coordinates + scale — bottom left */}
      <div className="absolute left-3 bottom-3 z-10 flex items-center gap-2 px-2.5 py-1 bg-background/80 backdrop-blur-sm border border-border rounded-md text-[10px] font-mono text-muted-foreground">
        <span data-testid="text-scale-ratio">1:{getApproxScale(zoom)}</span>
        {cursorCoord && (
          <>
            <span className="text-border">|</span>
            <span>{formatCoordinate(cursorCoord[1], "lat")}, {formatCoordinate(cursorCoord[0], "lng")}</span>
          </>
        )}
      </div>
    </>
  );
}
