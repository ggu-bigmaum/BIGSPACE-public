import { Style, Fill, Stroke, Circle as CircleStyle, Text as TextStyle } from "ol/style";
import type { Layer } from "@shared/schema";

export function getLayerStyle(layer: Layer) {
  return new Style({
    fill: new Fill({ color: layer.fillColor }),
    stroke: new Stroke({ color: layer.strokeColor, width: layer.strokeWidth }),
    image: new CircleStyle({
      radius: layer.pointRadius,
      fill: new Fill({ color: layer.fillColor }),
      stroke: new Stroke({ color: layer.strokeColor, width: layer.strokeWidth }),
    }),
  });
}

export function getHighlightStyle() {
  return new Style({
    fill: new Fill({ color: "rgba(255, 200, 0, 0.3)" }),
    stroke: new Stroke({ color: "#f59e0b", width: 3 }),
    image: new CircleStyle({
      radius: 8,
      fill: new Fill({ color: "rgba(255, 200, 0, 0.5)" }),
      stroke: new Stroke({ color: "#f59e0b", width: 3 }),
    }),
  });
}

export function getRegionStyle(count: number, layer: Layer) {
  const size = 20 + Math.log2(Math.max(count, 1)) * 5;
  const baseColor = layer.strokeColor || "#0d9488";
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);

  return new Style({
    image: new CircleStyle({
      radius: Math.min(size, 50),
      fill: new Fill({ color: `rgba(${r}, ${g}, ${b}, 0.35)` }),
      stroke: new Stroke({ color: `rgba(${r}, ${g}, ${b}, 0.9)`, width: 2.5 }),
    }),
    text: new TextStyle({
      text: count > 9999 ? `${(count / 1000).toFixed(0)}k` : count > 999 ? `${(count / 1000).toFixed(1)}k` : count.toString(),
      fill: new Fill({ color: "#ffffff" }),
      stroke: new Stroke({ color: `rgba(${r}, ${g}, ${b}, 0.8)`, width: 3 }),
      font: `bold ${Math.max(13, Math.min(size * 0.45, 18))}px sans-serif`,
    }),
  });
}

export function getClusterStyle(count: number) {
  const size = count <= 20
    ? 6 + Math.sqrt(count) * 4
    : 6 + Math.sqrt(20) * 4 + Math.log2(count / 20) * 4;
  return new Style({
    image: new CircleStyle({
      radius: size,
      fill: new Fill({ color: "rgba(0, 200, 220, 0.6)" }),
      stroke: new Stroke({ color: "#00d4e0", width: 2 }),
    }),
    text: new TextStyle({
      text: count > 999 ? `${(count / 1000).toFixed(1)}k` : count.toString(),
      fill: new Fill({ color: "#ffffff" }),
      font: `bold ${Math.max(11, size * 0.45)}px sans-serif`,
    }),
  });
}

export function getBoundaryCircleStyle(count: number, maxCount: number, name: string, layer: Layer, level: string) {
  if (count === 0) return new Style();
  const baseColor = layer.strokeColor || "#0d9488";
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);
  const isSido = level === "시도";
  const ratio = Math.sqrt(count / Math.max(maxCount, 1));
  const minR = isSido ? 12 : 8;
  const maxR = isSido ? 55 : 45;
  const radius = minR + (maxR - minR) * ratio;
  const countText = count > 99999 ? `${(count / 1000).toFixed(0)}k`
    : count > 9999 ? `${(count / 1000).toFixed(1)}k`
    : count > 999 ? `${(count / 1000).toFixed(1)}k`
    : count.toString();
  const fontSize = isSido ? Math.max(11, Math.min(radius * 0.35, 16)) : Math.max(10, Math.min(radius * 0.38, 14));

  return new Style({
    image: new CircleStyle({
      radius,
      fill: new Fill({ color: `rgba(${r}, ${g}, ${b}, 0.4)` }),
      stroke: new Stroke({ color: `rgba(${r}, ${g}, ${b}, 0.9)`, width: isSido ? 2.5 : 2 }),
    }),
    text: new TextStyle({
      text: `${name}\n${countText}`,
      fill: new Fill({ color: "#ffffff" }),
      stroke: new Stroke({ color: `rgba(0, 0, 0, 0.6)`, width: 3 }),
      font: `bold ${fontSize}px sans-serif`,
      textAlign: "center",
      offsetY: 0,
    }),
  });
}
