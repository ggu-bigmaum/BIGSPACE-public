import { useState } from "react";
import { GripVertical, Pencil, Trash2, Check } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
  onToggle: (layerId: string, visible: boolean) => void;
  onEdit: (layer: Layer, e: React.MouseEvent) => void;
  onDelete: (layerId: string) => void;
}

export function LayerRow({
  layer,
  onToggle,
  onEdit,
  onDelete,
}: LayerRowProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isRemote = !!(layer.wmsUrl || layer.wfsUrl);

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
  const active = layer.visible;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          ref={setNodeRef}
          style={style}
          className={`group/row relative flex items-center w-full h-8 cursor-pointer transition-colors select-none rounded-md mx-1 text-left ${
            active
              ? "bg-primary/[0.08] hover:bg-primary/[0.14]"
              : "hover:bg-accent/40"
          } ${isDragging ? "z-50" : ""}`}
          onClick={() => onToggle(layer.id, !layer.visible)}
          title={isRemote ? "WMS/WFS 레이어는 확대하면 표시됩니다" : undefined}
          data-testid={`button-toggle-layer-${layer.id}`}
        >
          {/* Drag handle — hover 시에만 */}
          <div
            className="flex items-center justify-center w-5 h-full cursor-grab shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity text-muted-foreground/40 hover:text-muted-foreground group-data-[collapsible=icon]:hidden"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-3 h-3" />
          </div>

          {/* Checkbox 16px */}
          <div
            className={`shrink-0 flex items-center justify-center w-4 h-4 rounded border-[1.5px] transition-colors duration-150 group-data-[collapsible=icon]:hidden ${
              active
                ? "bg-primary border-primary text-primary-foreground"
                : "border-muted-foreground/40 bg-transparent"
            }`}
          >
            {active && <Check className="w-3 h-3" strokeWidth={3} />}
          </div>

          {/* Layer name */}
          <span
            className={`text-sm leading-tight truncate flex-1 min-w-0 ml-2 group-data-[collapsible=icon]:hidden ${
              active ? "text-foreground/80 font-medium" : "text-muted-foreground/50"
            }`}
            data-testid={`text-layer-name-${layer.id}`}
          >
            {layer.name}
          </span>

          {/* Size label */}
          <span
            className={`text-sm tabular-nums mr-2 shrink-0 group-data-[collapsible=icon]:hidden ${
              active ? "text-muted-foreground/70" : "text-muted-foreground/40"
            }`}
            data-testid={`text-layer-size-${layer.id}`}
          >
            {sizeLabel}
          </span>

        </button>
      </ContextMenuTrigger>

      {/* 우클릭 컨텍스트 메뉴 */}
      <ContextMenuContent className="w-36">
        <ContextMenuItem
          onClick={(e) => onEdit(layer, e as any)}
          data-testid={`button-edit-layer-${layer.id}`}
        >
          <Pencil className="w-3.5 h-3.5 mr-2" />
          편집
        </ContextMenuItem>
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setDeleteOpen(true)}
          data-testid={`button-delete-layer-inline-${layer.id}`}
        >
          <Trash2 className="w-3.5 h-3.5 mr-2" />
          삭제
        </ContextMenuItem>
      </ContextMenuContent>

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
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(layer.id)}
              data-testid={`button-confirm-delete-inline-${layer.id}`}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContextMenu>
  );
}
