import ReactWindow from "react-window";
const { FixedSizeList: List } = ReactWindow as any;
import type { Layer } from "@shared/schema";
import { LayerRow } from "./LayerRow";

interface LayerListProps {
  layers: Layer[];
  height: number;
  onToggle: (layerId: string, visible: boolean) => void;
  onEdit: (layer: Layer, e: React.MouseEvent) => void;
  onDelete: (layerId: string) => void;
}

const ROW_HEIGHT = 32;
const VIRTUAL_THRESHOLD = 50;

export function LayerList({
  layers,
  height,
  onToggle,
  onEdit,
  onDelete,
}: LayerListProps) {
  // 50개 이하는 일반 DOM — 가상 스크롤 오버헤드 불필요
  if (layers.length <= VIRTUAL_THRESHOLD) {
    return (
      <div>
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
    );
  }

  // 50개 초과 — react-window 가상 스크롤
  return (
    <List
      height={height}
      itemCount={layers.length}
      itemSize={ROW_HEIGHT}
      width="100%"
      overscanCount={5}
    >
      {({ index, style }: { index: number; style: React.CSSProperties }) => (
        <div style={style}>
          <LayerRow
            layer={layers[index]}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      )}
    </List>
  );
}
