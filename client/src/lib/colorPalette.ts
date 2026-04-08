export interface LayerColor {
  strokeColor: string;
  fillColor: string;
  label: string;
}

export interface ColorFamily {
  label: string;
  shades: string[]; // light → dark
}

export const COLOR_FAMILIES: ColorFamily[] = [
  { label: "기본 (인디고)", shades: ["#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#3730a3"] },
  { label: "붉은 계열",    shades: ["#fca5a5", "#f87171", "#ef4444", "#dc2626", "#991b1b"] },
  { label: "푸른 계열",    shades: ["#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8"] },
  { label: "초록 계열",    shades: ["#86efac", "#4ade80", "#22c55e", "#16a34a", "#166534"] },
  { label: "보라 계열",    shades: ["#d8b4fe", "#c084fc", "#a855f7", "#9333ea", "#6b21a8"] },
  { label: "노란/앰버",    shades: ["#fde68a", "#fbbf24", "#f59e0b", "#d97706", "#92400e"] },
  { label: "틸/청록",      shades: ["#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#115e59"] },
  { label: "슬레이트",     shades: ["#e2e8f0", "#94a3b8", "#64748b", "#475569", "#1e293b"] },
];

// 팔레트에서 색상 자동 배정용 (기존 호환)
export const LAYER_PALETTE: LayerColor[] = COLOR_FAMILIES.flatMap((fam) =>
  fam.shades.slice(1, 4).map((shade) => ({
    strokeColor: shade,
    fillColor: shade,
    label: fam.label,
  }))
);

export function getNextColor(existingStrokeColors: string[]): LayerColor {
  const used = new Set(existingStrokeColors.map((c) => c.toLowerCase()));
  // 각 계열의 중간 색상(index 2) 우선 배정
  const candidates = COLOR_FAMILIES.map((f) => f.shades[2]);
  const pick = candidates.find((c) => !used.has(c.toLowerCase()));
  const stroke = pick ?? candidates[existingStrokeColors.length % candidates.length];
  return { strokeColor: stroke, fillColor: stroke, label: "" };
}
