import { Plus, Minus } from "lucide-react";

interface ZoomControlProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ZoomControl({ zoom, onZoomIn, onZoomOut }: ZoomControlProps) {
  return (
    <div className="flex items-center bg-background/80 backdrop-blur-sm border border-border rounded-md shadow-md overflow-hidden">
      <button
        className="px-2 py-1 hover:bg-accent transition-colors border-r border-border"
        onClick={onZoomIn}
        data-testid="button-zoom-in"
      >
        <Plus className="w-3.5 h-3.5 text-foreground" />
      </button>
      <div className="px-2 py-1 text-[10px] font-mono text-muted-foreground tabular-nums">
        Z{Math.round(zoom)}
      </div>
      <button
        className="px-2 py-1 hover:bg-accent transition-colors border-l border-border"
        onClick={onZoomOut}
        data-testid="button-zoom-out"
      >
        <Minus className="w-3.5 h-3.5 text-foreground" />
      </button>
    </div>
  );
}
