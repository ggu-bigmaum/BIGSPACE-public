import { useState } from "react";
import {
  ChevronRight,
  Eye,
  EyeOff,
  Siren,
  Landmark,
  Car,
  Building2,
  TreePine,
  Users,
  Package,
  Zap,
  Layers,
  Globe,
  Map,
  Hash,
} from "lucide-react";
import type { Layer } from "@shared/schema";
import { LayerRow } from "./LayerRow";

const ICON_MAP: Record<string, typeof Siren> = {
  "응급출동": Siren,
  "행정": Landmark,
  "교통": Car,
  "인프라": Building2,
  "환경": TreePine,
  "인구": Users,
  "물류": Package,
  "에너지": Zap,
  "공간데이터": Layers,
  "VWorld": Globe,
};
const FALLBACK_ICONS = [Hash, Globe, Map, Layers];

interface LayerGroupProps {
  category: string;
  layers: Layer[];
  selectedLayerId?: string | null;
  onToggle: (layerId: string, visible: boolean) => void;
  onSelect: (layerId: string | null) => void;
  onEdit: (layer: Layer, e: React.MouseEvent) => void;
  onDelete: (layerId: string) => void;
}

export function LayerGroup({
  category,
  layers,
  selectedLayerId,
  onToggle,
  onSelect,
  onEdit,
  onDelete,
}: LayerGroupProps) {
  const anyVisible = layers.some((l) => l.visible);
  const [open, setOpen] = useState(anyVisible);

  const Icon =
    ICON_MAP[category] ||
    FALLBACK_ICONS[category.length % FALLBACK_ICONS.length];

  const allVisible = layers.every((l) => l.visible);

  const handleBatchToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newVisible = !allVisible;
    layers.forEach((l) => {
      if (l.visible !== newVisible) {
        onToggle(l.id, newVisible);
      }
    });
  };

  return (
    <div data-testid={`category-label-${category}`}>
      {/* Group header — 접힌 사이드바에서 숨김 */}
      <button
        type="button"
        className="flex items-center w-full gap-1.5 px-2 py-1 text-left hover:bg-accent/40 transition-colors rounded-sm group-data-[collapsible=icon]:hidden"
        onClick={() => setOpen((prev) => !prev)}
      >
        <ChevronRight
          className={`w-3 h-3 text-muted-foreground transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
        <Icon className="w-3 h-3 text-primary shrink-0" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
          {category}
        </span>
        <span className="text-[9px] text-muted-foreground/60 ml-0.5">
          ({layers.length})
        </span>

        {/* Batch toggle */}
        <button
          type="button"
          className={`ml-auto flex items-center justify-center w-5 h-5 rounded shrink-0 transition-colors ${
            allVisible
              ? "text-foreground hover:text-muted-foreground"
              : "text-muted-foreground/40 hover:text-muted-foreground"
          }`}
          onClick={handleBatchToggle}
          aria-label={`Toggle all ${category} layers`}
        >
          {allVisible ? (
            <Eye className="w-3 h-3" />
          ) : (
            <EyeOff className="w-3 h-3" />
          )}
        </button>
      </button>

      {/* Layer rows */}
      {open && (
        <div className="ml-1">
          {layers.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              isSelected={selectedLayerId === layer.id}
              onToggle={onToggle}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
