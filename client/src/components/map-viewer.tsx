import { useEffect, useRef, useState, useCallback } from "react";
import GeoJSON from "ol/format/GeoJSON";
import { fromLonLat } from "ol/proj";
import { Feature as OlFeature } from "ol";
import { Point, Circle as CircleGeom, Polygon as OlPolygon } from "ol/geom";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import DragBox from "ol/interaction/DragBox";
import { transformExtent } from "ol/proj";
import { always } from "ol/events/condition";
import { Button } from "@/components/ui/button";
import { AlertTriangle, BoxSelect, MousePointer, ZoomIn } from "lucide-react";
import type { Layer } from "@shared/schema";
import { useMapInit } from "@/hooks/useMapInit";
import { useBasemapSync } from "@/hooks/useBasemapSync";
import { useLayerRenderer } from "@/hooks/useLayerRenderer";
import { useActiveBasemap, BasemapPicker } from "@/components/map/BasemapPicker";
import { ZoomControl } from "@/components/map/ZoomControl";
import { MapSearchBox } from "@/components/map/MapSearchBox";
import { FeaturePopup } from "@/components/map/FeaturePopup";

interface MapViewerProps {
  layers: Layer[];
  selectedLayerId: string | null;
  activeTool: string;
  mapView: { zoom: number; bbox: [number, number, number, number] };
  onViewChange: (view: { zoom: number; bbox: [number, number, number, number] }) => void;
  onMapClick?: (lng: number, lat: number) => void;
  onBoxSelect?: (bbox: [number, number, number, number]) => void;
  radiusCenter?: { lng: number; lat: number } | null;
  radiusKm?: number;
  searchResults?: any | null;
}

const geojsonFormat = new GeoJSON();

export function MapViewer({
  layers: layerList,
  activeTool,
  mapView,
  onViewChange,
  onMapClick,
  onBoxSelect,
  radiusCenter,
  radiusKm,
  searchResults: externalSearchResults,
}: MapViewerProps) {
  const [cursorCoord, setCursorCoord] = useState<[number, number] | null>(null);
  const [popupContent, setPopupContent] = useState<{ name: string; props: Record<string, any> } | null>(null);
  const [mapToolMode, setMapToolMode] = useState<"select" | "boxSelect">("select");

  const dragBoxRef = useRef<DragBox | null>(null);
  const selectionLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

  const {
    mapRef, popupRef, mapInstance,
    baseTileLayerRef, highlightLayerRef, radiusLayerRef,
    overlayRef, searchMarkerRef, searchMarkerElRef,
  } = useMapInit({
    onMapClick,
    onViewChange,
    onSetCursorCoord: setCursorCoord,
    onSetPopupContent: setPopupContent,
    onPopupPosition: (coord) => {
      overlayRef.current?.setPosition(coord);
    },
  });

  const activeBasemap = useActiveBasemap();
  const { kakaoMapDivRef, naverMapDivRef, basemapError } = useBasemapSync(
    mapInstance, baseTileLayerRef, activeBasemap
  );

  useLayerRenderer(mapInstance, layerList, mapView);

  // Cursor style
  useEffect(() => {
    const el = mapInstance.current?.getTargetElement() as HTMLElement | undefined;
    if (!el) return;
    el.style.cursor = mapToolMode === "boxSelect" || activeTool === "radius" ? "crosshair" : "default";
  }, [activeTool, mapToolMode]);

  // DragBox selection
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    if (dragBoxRef.current) { map.removeInteraction(dragBoxRef.current); dragBoxRef.current = null; }

    if (mapToolMode !== "boxSelect") {
      if (selectionLayerRef.current) { map.removeLayer(selectionLayerRef.current); selectionLayerRef.current = null; }
      return;
    }

    const dragBox = new DragBox({ condition: always });
    dragBoxRef.current = dragBox;
    map.addInteraction(dragBox);

    if (!selectionLayerRef.current) {
      const selLayer = new VectorLayer({
        source: new VectorSource(),
        style: new Style({
          stroke: new Stroke({ color: "rgba(0, 200, 255, 0.8)", width: 2, lineDash: [6, 4] }),
          fill: new Fill({ color: "rgba(0, 200, 255, 0.1)" }),
        }),
        zIndex: 9999,
      });
      selectionLayerRef.current = selLayer;
      map.addLayer(selLayer);
    }

    dragBox.on("boxend", () => {
      const extent = dragBox.getGeometry().getExtent();
      const [minX, minY, maxX, maxY] = transformExtent(extent, "EPSG:3857", "EPSG:4326");
      const src = selectionLayerRef.current?.getSource();
      if (src) {
        src.clear();
        src.addFeature(new OlFeature({
          geometry: new OlPolygon([[
            [extent[0], extent[1]], [extent[2], extent[1]],
            [extent[2], extent[3]], [extent[0], extent[3]], [extent[0], extent[1]],
          ]]),
        }));
      }
      onBoxSelect?.([minX, minY, maxX, maxY]);
    });

    return () => {
      if (dragBoxRef.current) { map.removeInteraction(dragBoxRef.current); dragBoxRef.current = null; }
    };
  }, [mapToolMode, onBoxSelect]);

  // Radius circle
  useEffect(() => {
    const source = radiusLayerRef.current?.getSource();
    if (!source) return;
    source.clear();

    if (radiusCenter && radiusKm) {
      const center = fromLonLat([radiusCenter.lng, radiusCenter.lat]);
      source.addFeature(new OlFeature({ geometry: new CircleGeom(center, radiusKm * 1000) }));
      const centerFeature = new OlFeature({ geometry: new Point(center) });
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

  // Search result highlight
  useEffect(() => {
    const source = highlightLayerRef.current?.getSource();
    if (!source) return;
    source.clear();
    if (externalSearchResults?.features) {
      source.addFeatures(geojsonFormat.readFeatures(externalSearchResults, { featureProjection: "EPSG:3857" }));
    }
  }, [externalSearchResults]);

  const handleZoomIn = useCallback(() => {
    const view = mapInstance.current?.getView();
    const zoom = view?.getZoom();
    if (zoom !== undefined) view?.animate({ zoom: Math.min(zoom + 1, 20), duration: 200 });
  }, []);

  const handleZoomOut = useCallback(() => {
    const view = mapInstance.current?.getView();
    const zoom = view?.getZoom();
    if (zoom !== undefined) view?.animate({ zoom: Math.max(zoom - 1, 2), duration: 200 });
  }, []);

  const handleMoveToLocation = useCallback((lat: number, lng: number, zoom = 15, label?: string) => {
    if (!mapInstance.current) return;
    mapInstance.current.getView().animate({ center: fromLonLat([lng, lat]), zoom, duration: 500 });
    if (searchMarkerRef.current && searchMarkerElRef.current) {
      searchMarkerRef.current.setPosition(fromLonLat([lng, lat]));
      searchMarkerElRef.current.style.display = "block";
      const labelEl = searchMarkerElRef.current.querySelector(".search-marker-label") as HTMLElement;
      if (labelEl) labelEl.textContent = label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }, []);

  return (
    <div
      className="relative w-full h-full"
      onClick={() => {
        // Close basemap picker handled inside BasemapPicker itself
      }}
    >
      <div ref={kakaoMapDivRef} className="absolute inset-0 z-[0]" style={{ display: "none", pointerEvents: "none" }} data-testid="kakao-map-container" />
      <div ref={naverMapDivRef} className="absolute inset-0 z-[0]" style={{ display: "none", pointerEvents: "none" }} data-testid="naver-map-container" />
      <div ref={mapRef} className="absolute inset-0 z-[1]" data-testid="map-container" />

      {layerList.some(l => l.visible && (l.wmsUrl || l.wfsUrl)) && mapView.zoom < 11 && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-black/70 text-white/90 backdrop-blur-sm rounded-md px-3 py-1.5 shadow-lg flex items-center gap-1.5 text-[11px]">
            <ZoomIn className="w-3.5 h-3.5 flex-shrink-0" />
            WMS/WFS 레이어는 줌 레벨을 높이면 표시됩니다
          </div>
        </div>
      )}

      {basemapError && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 max-w-md" data-testid="basemap-error">
          <div className="bg-destructive/90 text-destructive-foreground backdrop-blur-sm rounded-md px-4 py-2.5 shadow-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium">배경 지도 오류</p>
              <p className="text-[11px] mt-0.5 opacity-90">{basemapError}</p>
            </div>
          </div>
        </div>
      )}

      <MapSearchBox onMoveToLocation={handleMoveToLocation} />

      {/* Tool buttons */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <Button
          size="icon" variant="ghost"
          onClick={() => { setMapToolMode("select"); selectionLayerRef.current?.getSource()?.clear(); onBoxSelect?.(undefined as any); }}
          className={`w-8 h-8 backdrop-blur-sm border border-white/10 ${mapToolMode === "select" ? "bg-cyan-600/60 text-white" : "bg-black/60 text-white/70 hover:text-white"}`}
          data-testid="button-tool-select" title="이동/선택"
        >
          <MousePointer className="w-4 h-4" />
        </Button>
        <Button
          size="icon" variant="ghost"
          onClick={() => setMapToolMode("boxSelect")}
          className={`w-8 h-8 backdrop-blur-sm border border-white/10 ${mapToolMode === "boxSelect" ? "bg-cyan-600/60 text-white" : "bg-black/60 text-white/70 hover:text-white"}`}
          data-testid="button-tool-box-select" title="영역 선택"
        >
          <BoxSelect className="w-4 h-4" />
        </Button>
      </div>

      <ZoomControl
        zoom={mapView.zoom}
        cursorCoord={cursorCoord}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />

      <BasemapPicker />

      <FeaturePopup
        ref={popupRef}
        content={popupContent}
        onClose={() => { setPopupContent(null); overlayRef.current?.setPosition(undefined); }}
      />
    </div>
  );
}
