import { useState } from "react";
import {
  ChevronRight,
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
  selectedLayerId?: string | null;
  onToggle: (layerId: string, visible: boolean) => void;
  onSelect: (layerId: string | null) => void;
  onEdit: (layer: Layer, e: React.MouseEvent) => void;
  onDelete: (layerId: string) => void;
}

// Sub-group: +/- 트리 노드 스타일
function SubGroup({
  subCategory,
  layers,
  selectedLayerId,
  onToggle,
  onSelect,
  onEdit,
  onDelete,
}: {
  subCategory: string;
  layers: Layer[];
  selectedLayerId?: string | null;
  onToggle: (layerId: string, visible: boolean) => void;
  onSelect: (layerId: string | null) => void;
  onEdit: (layer: Layer, e: React.MouseEvent) => void;
  onDelete: (layerId: string) => void;
}) {
  const anyVisible = layers.some((l) => l.visible);
  const [open, setOpen] = useState(anyVisible);
  const allVisible = layers.every((l) => l.visible);

  const handleBatchToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newVisible = !allVisible;
    layers.forEach((l) => {
      if (l.visible !== newVisible) onToggle(l.id, newVisible);
    });
  };

  return (
    <div>
      <button
        type="button"
        className="flex items-center w-full gap-1 pl-5 pr-2 py-[3px] text-left hover:bg-accent/30 transition-colors group-data-[collapsible=icon]:hidden"
        onClick={() => setOpen((prev) => !prev)}
      >
        {/* +/- 아이콘 */}
        <span className="flex items-center justify-center w-3.5 h-3.5 shrink-0 text-muted-foreground/70">
          {open ? <Minus className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
        </span>

        {/* 서브카테고리 체크박스 (전체 토글) */}
        <button
          type="button"
          role="checkbox"
          aria-checked={allVisible}
          className={`shrink-0 flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors duration-150 ${
            allVisible
              ? "bg-primary border-primary text-primary-foreground"
              : anyVisible
                ? "border-primary bg-primary/30 text-primary-foreground"
                : "border-muted-foreground/40 bg-transparent"
          }`}
          onClick={handleBatchToggle}
        >
          {allVisible && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
          {!allVisible && anyVisible && <Minus className="w-2.5 h-2.5" strokeWidth={3} />}
        </button>

        <span className="text-[11px] text-muted-foreground/80 truncate ml-0.5">
          {subCategory}
        </span>
        <span className="text-[9px] text-muted-foreground/50 ml-auto shrink-0">
          {layers.length}
        </span>
      </button>

      {open && (
        <div className="ml-4">
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
      {/* Category header */}
      <button
        type="button"
        className="flex items-center w-full gap-1.5 px-2 py-1 text-left hover:bg-accent/40 transition-colors group-data-[collapsible=icon]:hidden"
        onClick={() => setOpen((prev) => !prev)}
      >
        <ChevronRight
          className={`w-3 h-3 text-muted-foreground transition-transform shrink-0 ${
            open ? "rotate-90" : ""
          }`}
        />
        <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
          {category}
        </span>
        <span className="text-[9px] text-muted-foreground/60 ml-auto shrink-0">
          {layers.length}
        </span>

        {/* Category batch toggle checkbox */}
        <button
          type="button"
          role="checkbox"
          aria-checked={allVisible}
          className={`flex items-center justify-center w-4 h-4 rounded border shrink-0 transition-colors ${
            allVisible
              ? "bg-primary border-primary text-primary-foreground"
              : anyVisible
                ? "border-primary bg-primary/30 text-primary-foreground"
                : "border-muted-foreground/40 bg-transparent"
          }`}
          onClick={handleBatchToggle}
        >
          {allVisible && <Check className="w-3 h-3" strokeWidth={3} />}
          {!allVisible && anyVisible && <Minus className="w-3 h-3" strokeWidth={3} />}
        </button>
      </button>

      {/* Layer rows */}
      {open && (
        <div>
          {/* Ungrouped layers first */}
          {ungrouped.map((layer) => (
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

          {/* Sub-category groups */}
          {hasSubGroups && Array.from(subGroups.entries()).map(([sub, subLayers]) => (
            <SubGroup
              key={sub}
              subCategory={sub}
              layers={subLayers}
              selectedLayerId={selectedLayerId}
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
