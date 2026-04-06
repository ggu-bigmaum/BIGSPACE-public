import { useState } from "react";
import { Eye, EyeOff, GripVertical, Pencil, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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

      {/* Drag handle — visible on hover */}
      <div
        className={`flex items-center justify-center w-5 shrink-0 ${
          hovered ? "opacity-100" : "opacity-0"
        } transition-opacity`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3 h-3 text-muted-foreground cursor-grab" />
      </div>

      {/* Color dot */}
      <div
        className="w-3 h-3 rounded-full shrink-0 border"
        style={{
          backgroundColor: layer.fillColor,
          borderColor: layer.strokeColor,
        }}
      />

      {/* Layer name */}
      <span
        className={`ml-1.5 text-[13px] truncate flex-1 min-w-0 ${
          inactive ? "text-muted-foreground opacity-50" : ""
        }`}
        data-testid={`text-layer-name-${layer.id}`}
      >
        {layer.name}
      </span>

      {/* Right side: size/type badge when not hovered, edit/delete when hovered */}
      <div className="flex items-center gap-0.5 shrink-0 mr-1">
        {hovered ? (
          <>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={(e) => onEdit(layer, e)}
                    data-testid={`button-edit-layer-${layer.id}`}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  편집
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AlertDialog>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`button-delete-layer-inline-${layer.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    삭제
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
          </>
        ) : (
          <span
            className={`text-[9px] text-muted-foreground ${
              inactive ? "opacity-50" : ""
            }`}
            data-testid={`text-layer-size-${layer.id}`}
          >
            {sizeLabel}
          </span>
        )}
      </div>

      {/* Eye toggle — always visible */}
      <button
        type="button"
        className={`flex items-center justify-center w-6 h-6 shrink-0 mr-1 rounded transition-colors ${
          layer.visible
            ? "text-foreground hover:text-muted-foreground"
            : "text-muted-foreground/40 hover:text-muted-foreground"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(layer.id, !layer.visible);
        }}
        data-testid={`switch-toggle-visibility-${layer.id}`}
      >
        {layer.visible ? (
          <Eye className="w-3.5 h-3.5" />
        ) : (
          <EyeOff className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
