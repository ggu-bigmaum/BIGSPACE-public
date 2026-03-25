import { Button } from "@/components/ui/button";
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
      {/* Zoom buttons */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1">
        <Button
          size="icon" variant="ghost" onClick={onZoomIn}
          className="bg-black/60 backdrop-blur-sm text-white/80 hover:text-white border border-white/10"
          data-testid="button-zoom-in"
        >
          <Plus className="w-4 h-4" />
        </Button>
        <Button
          size="icon" variant="ghost" onClick={onZoomOut}
          className="bg-black/60 backdrop-blur-sm text-white/80 hover:text-white border border-white/10"
          data-testid="button-zoom-out"
        >
          <Minus className="w-4 h-4" />
        </Button>
      </div>

      {/* Scale bar */}
      <div className="absolute bottom-3 right-3 z-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-md border border-white/10 px-2.5 py-1 flex items-center gap-2">
          <span className="text-[10px] font-mono text-white/70" data-testid="text-zoom-level">Z{zoom}</span>
          <span className="text-[10px] font-mono text-cyan-400 font-bold" data-testid="text-scale-ratio">
            1:{getApproxScale(zoom)}
          </span>
          {cursorCoord && (
            <span className="text-[10px] font-mono text-white/50">
              {formatCoordinate(cursorCoord[1], "lat")}, {formatCoordinate(cursorCoord[0], "lng")}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
