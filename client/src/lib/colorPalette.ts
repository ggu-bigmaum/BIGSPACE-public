export interface LayerColor {
  strokeColor: string;
  fillColor: string;
  label: string;
}

export const LAYER_PALETTE: LayerColor[] = [
  { strokeColor: "#0d9488", fillColor: "#0d948850", label: "틸" },
  { strokeColor: "#6366f1", fillColor: "#6366f150", label: "인디고" },
  { strokeColor: "#0284c7", fillColor: "#0284c750", label: "스카이" },
  { strokeColor: "#7c3aed", fillColor: "#7c3aed50", label: "바이올렛" },
  { strokeColor: "#ca8a04", fillColor: "#ca8a0440", label: "앰버" },
  { strokeColor: "#dc2626", fillColor: "#dc262640", label: "레드" },
  { strokeColor: "#059669", fillColor: "#05966950", label: "에메랄드" },
  { strokeColor: "#d97706", fillColor: "#d9770640", label: "오렌지" },
  { strokeColor: "#4f46e5", fillColor: "#4f46e550", label: "코발트" },
  { strokeColor: "#db2777", fillColor: "#db277740", label: "핑크" },
  { strokeColor: "#2563eb", fillColor: "#2563eb50", label: "블루" },
  { strokeColor: "#65a30d", fillColor: "#65a30d40", label: "라임" },
  { strokeColor: "#475569", fillColor: "#47556940", label: "슬레이트" },
  { strokeColor: "#9333ea", fillColor: "#9333ea40", label: "퍼플" },
  { strokeColor: "#0891b2", fillColor: "#0891b250", label: "시안" },
  { strokeColor: "#ea580c", fillColor: "#ea580c40", label: "탄제린" },
];

export function getNextColor(existingStrokeColors: string[]): LayerColor {
  const used = new Set(existingStrokeColors.map((c) => c.toLowerCase()));
  for (const color of LAYER_PALETTE) {
    if (!used.has(color.strokeColor.toLowerCase())) {
      return color;
    }
  }
  const idx = existingStrokeColors.length % LAYER_PALETTE.length;
  return LAYER_PALETTE[idx];
}
