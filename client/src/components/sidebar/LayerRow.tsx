import { useState } from "react";
import { GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Layer } from "@shared/schema";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function getSizeLabel(layer: Layer): string {
  if (layer.wmsUrl) return "WMS";
  if (layer.wfsUrl) return "WFS";
  if (layer.renderMode === "tile" || layer.renderMode === "heatmap") return "Stream";
  return formatCount(layer.featureCount ?? 0);
}

interface LayerRowProps {
  layer: Layer;
  isSelected: boolean;
  onToggle: (layerId: string, visible: boolean) => void;
  onSelect: (layerId: string | null) => void;
  onEdit: (layer: Layer, e: React.MouseEvent) => void;
  onDelete: (layerId: string) => void;
}

export function LayerRow({
  layer,
  isSelected,
  onToggle,
  onSelect,
  onEdit,
  onDelete,
}: LayerRowProps) {
  const [hovered, setHovered] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const sizeLabel = getSizeLabel(layer);
  const inactive = !layer.visible;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center h-8 cursor-pointer transition-colors select-none ${
        isSelected ? "bg-accent" : "hover:bg-accent/50"
      } ${isDragging ? "z-50" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(isSelected ? null : layer.id)}
      data-testid={`button-select-layer-${layer.id}`}
    >
      {/* Left color bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l"
        style={{ backgroundColor: layer.strokeColor }}
      />

      {/* Mini toggle — 접힌 상태에서 숨김 */}
      <button
        type="button"
        role="switch"
        aria-checked={layer.visible}
        className={`relative ml-2 mr-1 shrink-0 h-3.5 w-6 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-data-[collapsible=icon]:hidden ${
          layer.visible ? "bg-primary" : "bg-muted-foreground/25"
        }`}
        onClick={(e) => { e.stopPropagation(); onToggle(layer.id, !layer.visible); }}
        data-testid={`switch-toggle-visibility-${layer.id}`}
      >
        <span
          className={`absolute top-[2px] left-[2px] block h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform duration-150 ${
            layer.visible ? "translate-x-2.5" : "translate-x-0"
          }`}
        />
      </button>

      {/* Color dot — 접힌 상태에서도 표시, 가시성에 따라 투명도 변경 */}
      <div
        className={`w-3 h-3 rounded-full shrink-0 transition-opacity group-data-[collapsible=icon]:mx-auto ${
          inactive ? "opacity-30" : "opacity-100"
        }`}
        style={{ backgroundColor: layer.fillColor }}
      />

      {/* Layer name — 접힌 상태에서 숨김 */}
      <span
        className={`ml-1.5 text-[13px] truncate flex-1 min-w-0 group-data-[collapsible=icon]:hidden ${
          inactive ? "text-muted-foreground opacity-50" : ""
        }`}
        data-testid={`text-layer-name-${layer.id}`}
      >
        {layer.name}
      </span>

      {/* Right side: size label or more menu — 접힌 상태에서 숨김 */}
      <div className="flex items-center gap-0.5 shrink-0 mr-1 group-data-[collapsible=icon]:hidden">
        {hovered ? (
          <>
            {/* Drag handle */}
            <div
              className="flex items-center justify-center w-5 h-5 cursor-grab text-muted-foreground/50 hover:text-muted-foreground"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-3 h-3" />
            </div>

            {/* More menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onEdit(layer, e as any); }}
                  data-testid={`button-edit-layer-${layer.id}`}
                >
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  편집
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}
                  data-testid={`button-delete-layer-inline-${layer.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <span
            className={`text-[9px] text-muted-foreground tabular-nums ${
              inactive ? "opacity-50" : ""
            }`}
            data-testid={`text-layer-size-${layer.id}`}
          >
            {sizeLabel}
          </span>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>레이어를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>"{layer.name}"</strong> 레이어와 모든 피처 데이터가
              영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(layer.id);
              }}
              data-testid={`button-confirm-delete-inline-${layer.id}`}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
