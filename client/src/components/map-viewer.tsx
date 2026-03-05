import { useEffect, useRef, useState, useCallback } from "react";
import OlMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import GeoJSON from "ol/format/GeoJSON";
import { fromLonLat, toLonLat } from "ol/proj";
import { Style, Fill, Stroke, Circle as CircleStyle, Text as TextStyle } from "ol/style";
import { Feature as OlFeature } from "ol";
import { Point, Circle as CircleGeom } from "ol/geom";
import Overlay from "ol/Overlay";
import { defaults as defaultControls } from "ol/control";
import type { Layer, Feature } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { formatCoordinate } from "@/lib/mapUtils";

interface MapViewerProps {
  layers: Layer[];
  selectedLayerId: string | null;
  activeTool: string;
  onMapClick?: (lng: number, lat: number) => void;
  onBboxChange?: (bbox: number[]) => void;
  onZoomChange?: (zoom: number) => void;
  radiusCenter?: { lng: number; lat: number } | null;
  radiusKm?: number;
  searchResults?: any | null;
}

const geojsonFormat = new GeoJSON();

function getLayerStyle(layer: Layer) {
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

function getHighlightStyle() {
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

function getClusterStyle(count: number) {
  const size = Math.min(40, Math.max(16, Math.log2(count) * 6));
  return new Style({
    image: new CircleStyle({
      radius: size,
      fill: new Fill({ color: "rgba(59, 130, 246, 0.7)" }),
      stroke: new Stroke({ color: "#2563eb", width: 2 }),
    }),
    text: new TextStyle({
      text: count > 999 ? `${(count / 1000).toFixed(1)}k` : count.toString(),
      fill: new Fill({ color: "#ffffff" }),
      font: `bold ${Math.max(11, size * 0.5)}px sans-serif`,
    }),
  });
}

export function MapViewer({
  layers: layerList,
  selectedLayerId,
  activeTool,
  onMapClick,
  onBboxChange,
  onZoomChange,
  radiusCenter,
  radiusKm,
  searchResults,
}: MapViewerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<OlMap | null>(null);
  const vectorLayersRef = useRef<Map<string, VectorLayer<VectorSource>>>(new Map());
  const highlightLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const radiusLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const [currentZoom, setCurrentZoom] = useState(11);
  const [cursorCoord, setCursorCoord] = useState<[number, number] | null>(null);
  const [popupContent, setPopupContent] = useState<{ name: string; props: Record<string, any> } | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = new OlMap({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: fromLonLat([126.978, 37.5665]),
        zoom: 11,
        maxZoom: 20,
        minZoom: 2,
      }),
      controls: defaultControls({ zoom: true, rotate: false, attribution: false }),
    });

    const highlightSource = new VectorSource();
    const highlightLayer = new VectorLayer({
      source: highlightSource,
      style: getHighlightStyle(),
      zIndex: 100,
    });
    map.addLayer(highlightLayer);
    highlightLayerRef.current = highlightLayer;

    const radiusSource = new VectorSource();
    const radiusLayer = new VectorLayer({
      source: radiusSource,
      style: new Style({
        fill: new Fill({ color: "rgba(239, 68, 68, 0.1)" }),
        stroke: new Stroke({ color: "#ef4444", width: 2, lineDash: [8, 4] }),
      }),
      zIndex: 90,
    });
    map.addLayer(radiusLayer);
    radiusLayerRef.current = radiusLayer;

    if (popupRef.current) {
      const overlay = new Overlay({
        element: popupRef.current,
        autoPan: true,
        positioning: "bottom-center",
        offset: [0, -12],
      });
      map.addOverlay(overlay);
      overlayRef.current = overlay;
    }

    map.on("moveend", () => {
      const view = map.getView();
      const zoom = view.getZoom() || 11;
      setCurrentZoom(Math.round(zoom));
      onZoomChange?.(zoom);

      const extent = view.calculateExtent(map.getSize());
      const bl = toLonLat([extent[0], extent[1]]);
      const tr = toLonLat([extent[2], extent[3]]);
      onBboxChange?.([bl[0], bl[1], tr[0], tr[1]]);
    });

    map.on("pointermove", (e) => {
      const coord = toLonLat(e.coordinate);
      setCursorCoord([coord[0], coord[1]]);

      const hit = map.hasFeatureAtPixel(e.pixel);
      const target = map.getTargetElement();
      if (target) {
        (target as HTMLElement).style.cursor = hit ? "pointer" : (activeTool === "radius" ? "crosshair" : "default");
      }
    });

    map.on("click", (e) => {
      const coord = toLonLat(e.coordinate);
      onMapClick?.(coord[0], coord[1]);

      let clicked = false;
      map.forEachFeatureAtPixel(e.pixel, (feature) => {
        if (clicked) return;
        clicked = true;
        const props = feature.getProperties();
        delete props.geometry;
        const name = props.name || props._id || "Feature";
        setPopupContent({ name, props });
        overlayRef.current?.setPosition(e.coordinate);
      });

      if (!clicked) {
        setPopupContent(null);
        overlayRef.current?.setPosition(undefined);
      }
    });

    mapInstance.current = map;

    return () => {
      map.setTarget(undefined);
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    const target = mapInstance.current.getTargetElement();
    if (target) {
      (target as HTMLElement).style.cursor = activeTool === "radius" ? "crosshair" : "default";
    }
  }, [activeTool]);

  const shouldUseAggregate = useCallback((layer: Layer, zoom: number): boolean => {
    if (layer.renderMode === "aggregate") return true;
    if (layer.renderMode === "feature") return false;
    if (layer.renderMode === "tile") return zoom < layer.minZoomForFeatures;
    return zoom < layer.minZoomForFeatures && layer.featureCount > 100;
  }, []);

  const fetchAndRenderLayer = useCallback(async (layer: Layer) => {
    if (!mapInstance.current) return;

    const map = mapInstance.current;
    const existingLayer = vectorLayersRef.current.get(layer.id);

    if (!layer.visible) {
      if (existingLayer) {
        existingLayer.setVisible(false);
      }
      return;
    }

    const view = map.getView();
    const extent = view.calculateExtent(map.getSize());
    const bl = toLonLat([extent[0], extent[1]]);
    const tr = toLonLat([extent[2], extent[3]]);
    const bbox = `${bl[0]},${bl[1]},${tr[0]},${tr[1]}`;
    const zoom = view.getZoom() || 11;

    try {
      if (shouldUseAggregate(layer, zoom)) {
        const res = await fetch(`/api/layers/${layer.id}/aggregate?bbox=${bbox}&gridSize=20`);
        const gridData = await res.json();

        const source = new VectorSource();
        gridData.forEach((cell: { lng: number; lat: number; count: number }) => {
          const feature = new OlFeature({
            geometry: new Point(fromLonLat([cell.lng, cell.lat])),
            count: cell.count,
            name: `${cell.count} features`,
          });
          feature.setStyle(getClusterStyle(cell.count));
          source.addFeature(feature);
        });

        if (existingLayer) {
          existingLayer.setSource(source);
          existingLayer.setVisible(true);
          existingLayer.setOpacity(layer.opacity);
        } else {
          const vl = new VectorLayer({ source, zIndex: 10 });
          vl.setOpacity(layer.opacity);
          map.addLayer(vl);
          vectorLayersRef.current.set(layer.id, vl);
        }
      } else {
        const res = await fetch(`/api/layers/${layer.id}/features?bbox=${bbox}&limit=${layer.featureLimit}&zoom=${Math.round(zoom)}`);
        const geojson = await res.json();

        const source = new VectorSource({
          features: geojsonFormat.readFeatures(geojson, {
            featureProjection: "EPSG:3857",
          }),
        });

        const style = getLayerStyle(layer);

        if (existingLayer) {
          existingLayer.setSource(source);
          existingLayer.setStyle(style);
          existingLayer.setVisible(true);
          existingLayer.setOpacity(layer.opacity);
        } else {
          const vl = new VectorLayer({ source, style, zIndex: 10 });
          vl.setOpacity(layer.opacity);
          map.addLayer(vl);
          vectorLayersRef.current.set(layer.id, vl);
        }
      }
    } catch (err) {
      console.error("Failed to load layer:", layer.name, err);
    }
  }, [shouldUseAggregate]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!mapInstance.current) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const currentLayerIds = new Set(layerList.map(l => l.id));
      vectorLayersRef.current.forEach((vl, id) => {
        if (!currentLayerIds.has(id)) {
          mapInstance.current?.removeLayer(vl);
          vectorLayersRef.current.delete(id);
        }
      });

      layerList.forEach(layer => {
        fetchAndRenderLayer(layer);
      });
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [layerList, currentZoom, fetchAndRenderLayer]);

  useEffect(() => {
    if (!radiusLayerRef.current) return;
    const source = radiusLayerRef.current.getSource();
    if (!source) return;
    source.clear();

    if (radiusCenter && radiusKm) {
      const center = fromLonLat([radiusCenter.lng, radiusCenter.lat]);
      const radiusMeters = radiusKm * 1000;
      const circle = new CircleGeom(center, radiusMeters);
      const feature = new OlFeature({ geometry: circle });
      source.addFeature(feature);

      const centerFeature = new OlFeature({
        geometry: new Point(center),
      });
      centerFeature.setStyle(new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: "#ef4444" }),
          stroke: new Stroke({ color: "#ffffff", width: 2 }),
        }),
      }));
      source.addFeature(centerFeature);
    }
  }, [radiusCenter, radiusKm]);

  useEffect(() => {
    if (!highlightLayerRef.current) return;
    const source = highlightLayerRef.current.getSource();
    if (!source) return;
    source.clear();

    if (searchResults && searchResults.features) {
      const features = geojsonFormat.readFeatures(searchResults, {
        featureProjection: "EPSG:3857",
      });
      source.addFeatures(features);
    }
  }, [searchResults]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" data-testid="map-container" />

      <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
        <div className="bg-card/90 backdrop-blur-sm border border-card-border rounded-md px-3 py-1.5 flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">Z{currentZoom}</Badge>
          {cursorCoord && (
            <span className="text-[10px] font-mono text-muted-foreground">
              {formatCoordinate(cursorCoord[1], "lat")}, {formatCoordinate(cursorCoord[0], "lng")}
            </span>
          )}
        </div>
      </div>

      <div className="absolute bottom-3 left-3 z-10">
        <div className="bg-card/90 backdrop-blur-sm border border-card-border rounded-md px-3 py-1.5">
          <span className="text-[10px] text-muted-foreground">EPSG:3857 (Display) / EPSG:4326 (Data)</span>
        </div>
      </div>

      <div ref={popupRef} className="absolute" style={{ display: popupContent ? "block" : "none" }}>
        {popupContent && (
          <div className="bg-card border border-card-border rounded-md shadow-lg p-3 max-w-[280px] min-w-[180px]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 className="text-sm font-semibold truncate">{popupContent.name}</h4>
              <button
                onClick={() => {
                  setPopupContent(null);
                  overlayRef.current?.setPosition(undefined);
                }}
                className="text-muted-foreground text-xs"
                data-testid="button-close-popup"
              >
                x
              </button>
            </div>
            <div className="space-y-1">
              {Object.entries(popupContent.props)
                .filter(([k]) => !k.startsWith("_"))
                .slice(0, 8)
                .map(([key, value]) => (
                  <div key={key} className="flex items-start gap-2 text-[11px]">
                    <span className="text-muted-foreground min-w-[60px] flex-shrink-0">{key}</span>
                    <span className="font-medium break-all">{String(value)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
