import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Minus,
  Check,
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
  Map as MapIcon,
  Hash,
} from "lucide-react";
import type { Layer } from "@shared/schema";
import { LayerRow } from "./LayerRow";

const ICON_MAP: Record<string, typeof Siren> = {
  "응급출동": Siren,
  "행정": Landmark,
  "행정경계": Landmark,
  "교통": Car,
  "인프라": Building2,
  "환경": TreePine,
  "인구": Users,
  "물류": Package,
  "에너지": Zap,
  "공간데이터": Layers,
  "VWorld": Globe,
};
const FALLBACK_ICONS = [Hash, Globe, MapIcon, Layers];

interface LayerGroupProps {
  category: string;
  layers: Layer[];
  onToggle: (layerId: string, visible: boolean) => void;
  onEdit: (layer: Layer, e: React.MouseEvent) => void;
  onDelete: (layerId: string) => void;
}

// Sub-group: +/- 트리 노드 스타일
function SubGroup({
  subCategory,
  layers,
  onToggle,
  onEdit,
  onDelete,
}: {
  subCategory: string;
  layers: Layer[];
  onToggle: (layerId: string, visible: boolean) => void;
  onEdit: (layer: Layer, e: React.MouseEvent) => void;
  onDelete: (layerId: string) => void;
}) {
  const anyVisible = layers.some((l) => l.visible);
  const allVisible = layers.every((l) => l.visible);
  const [open, setOpen] = useState(anyVisible);

  const handleBatchToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newVisible = !allVisible;
    for (const l of layers) {
      if (l.visible !== newVisible) onToggle(l.id, newVisible);
    }
  };

  return (
    <div>
      <div
        className="flex items-center w-full gap-1.5 pl-6 pr-2 py-1 text-left hover:bg-accent/30 transition-colors group-data-[collapsible=icon]:hidden cursor-pointer"
        onClick={() => setOpen((prev) => !prev)}
      >
        {/* Checkbox */}
        <div
          className={`shrink-0 flex items-center justify-center w-4 h-4 rounded border-[1.5px] transition-colors duration-150 cursor-pointer ${
            allVisible
              ? "bg-primary border-primary text-primary-foreground"
              : anyVisible
                ? "border-primary/50 bg-primary/20 text-primary-foreground"
                : "border-muted-foreground/40 bg-transparent"
          }`}
          onClick={handleBatchToggle}
        >
          {(allVisible || anyVisible) && <Check className="w-3 h-3" strokeWidth={3} />}
        </div>

        {/* +/- 아이콘 */}
        <span className="flex items-center justify-center w-3.5 h-3.5 shrink-0 text-muted-foreground/60">
          {open ? <Minus className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
        </span>

        <span className="text-sm text-muted-foreground truncate font-medium">
          {subCategory}
        </span>
        <span className="text-sm text-muted-foreground/50 ml-auto shrink-0">
          {layers.length}
        </span>
      </div>

      {open && (
        <div className="ml-4">
          {layers.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LayerGroup({
  category,
  layers,
  onToggle,
  onEdit,
  onDelete,
}: LayerGroupProps) {
  const anyVisible = layers.some((l) => l.visible);
  const [open, setOpen] = useState(anyVisible);

  const Icon =
    ICON_MAP[category] ||
    FALLBACK_ICONS[category.length % FALLBACK_ICONS.length];

  // Split layers into sub-groups and ungrouped
  const subGroups = new Map<string, Layer[]>();
  const ungrouped: Layer[] = [];

  for (const layer of layers) {
    const sub = layer.subCategory?.trim();
    if (sub) {
      if (!subGroups.has(sub)) subGroups.set(sub, []);
      subGroups.get(sub)!.push(layer);
    } else {
      ungrouped.push(layer);
    }
  }

  const hasSubGroups = subGroups.size > 0;

  return (
    <div data-testid={`category-label-${category}`}>
      {/* Category header — 클릭 = 접기/펼치기만 */}
      <button
        type="button"
        className="flex items-center w-full gap-1.5 px-2 py-1.5 text-left hover:bg-accent/40 transition-colors group-data-[collapsible=icon]:hidden"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
        }
        <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground/70 tracking-wide truncate">
          {category}
        </span>
        <span className="text-sm text-muted-foreground/60 ml-auto shrink-0">
          {layers.length}
        </span>
      </button>

      {/* Layer rows */}
      {open && (
        <div className="pb-1">
          {/* Ungrouped layers first */}
          {ungrouped.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}

          {/* Sub-category groups */}
          {hasSubGroups && Array.from(subGroups.entries()).map(([sub, subLayers]) => (
            <SubGroup
              key={sub}
              subCategory={sub}
              layers={subLayers}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
