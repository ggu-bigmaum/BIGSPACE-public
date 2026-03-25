import type { Layer } from "@shared/schema";

export function getApproxScale(zoom: number): string {
  const scaleMap: Record<number, string> = {
    2: "150,000,000", 3: "70,000,000", 4: "35,000,000", 5: "15,000,000",
    6: "10,000,000", 7: "4,000,000", 8: "2,000,000", 9: "1,000,000",
    10: "500,000", 11: "250,000", 12: "150,000", 13: "70,000",
    14: "35,000", 15: "15,000", 16: "8,000", 17: "4,000",
    18: "2,000", 19: "1,000", 20: "500",
  };
  return scaleMap[zoom] || scaleMap[Math.min(20, Math.max(2, Math.round(zoom)))] || "N/A";
}

export function getLayerColor(layer: Layer): string {
  return layer.strokeColor || "#3b82f6";
}

export function formatCoordinate(coord: number, type: "lng" | "lat"): string {
  const dir = type === "lng" ? (coord >= 0 ? "E" : "W") : (coord >= 0 ? "N" : "S");
  return `${Math.abs(coord).toFixed(6)}${dir}`;
}

export function formatBbox(bbox: number[]): string {
  if (bbox.length !== 4) return "";
  return `${bbox[0].toFixed(4)}, ${bbox[1].toFixed(4)} ~ ${bbox[2].toFixed(4)}, ${bbox[3].toFixed(4)}`;
}

export function getGeometryIcon(type: string): string {
  switch (type) {
    case "Point": return "circle";
    case "LineString": return "route";
    case "Polygon": return "square";
    default: return "layers";
  }
}

export function getRenderModeLabel(mode: string): string {
  switch (mode) {
    case "auto": return "Auto";
    case "feature": return "Feature";
    case "tile": return "Tile";
    case "aggregate": return "Aggregate";
    default: return mode;
  }
}

export function calculateDistance(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
