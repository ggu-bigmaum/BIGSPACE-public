import { useEffect, useRef } from "react";
import OlMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import { fromLonLat, toLonLat } from "ol/proj";
import { Style, Fill, Stroke } from "ol/style";
import Overlay from "ol/Overlay";
import { defaults as defaultControls, OverviewMap } from "ol/control";
import { getHighlightStyle } from "@/lib/mapStyles";

interface UseMapInitOptions {
  onMapClick?: (lng: number, lat: number) => void;
  onViewChange: (view: { zoom: number; bbox: [number, number, number, number] }) => void;
  onSetCursorCoord: (coord: [number, number] | null) => void;
  onSetPopupContent: (content: { name: string; props: Record<string, any> } | null) => void;
  onPopupPosition: (coordinate: number[] | undefined) => void;
}

export function useMapInit({
  onMapClick, onViewChange,
  onSetCursorCoord, onSetPopupContent, onPopupPosition,
}: UseMapInitOptions) {
  const mapRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<OlMap | null>(null);
  const baseTileLayerRef = useRef<TileLayer | null>(null);
  const highlightLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const radiusLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const searchMarkerRef = useRef<Overlay | null>(null);
  const searchMarkerElRef = useRef<HTMLDivElement | null>(null);

  // Use refs to avoid stale closures in event handlers
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  useEffect(() => {
    if (!mapRef.current) return;

    const tileLayer = new TileLayer({ source: new OSM(), zIndex: 0 });
    baseTileLayerRef.current = tileLayer;

    const map = new OlMap({
      target: mapRef.current,
      layers: [tileLayer],
      view: new View({
        center: fromLonLat([126.978, 37.5665]),
        zoom: 11,
        maxZoom: 20,
        minZoom: 2,
      }),
      controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
    });

    // ── 오버뷰 맵 (미니맵) ──
    const overviewMap = new OverviewMap({
      collapsed: false,
      collapsible: true,
      layers: [new TileLayer({ source: new OSM() })],
      view: new View({
        projection: "EPSG:3857",
        maxZoom: 8,
        minZoom: 4,
      }),
    });
    map.addControl(overviewMap);

    const highlightLayer = new VectorLayer({
      source: new VectorSource(),
      style: getHighlightStyle(),
      zIndex: 100,
    });
    map.addLayer(highlightLayer);
    highlightLayerRef.current = highlightLayer;

    const radiusLayer = new VectorLayer({
      source: new VectorSource(),
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

    const markerEl = document.createElement("div");
    markerEl.className = "search-marker";
    markerEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
        <svg width="32" height="42" viewBox="0 0 32 42">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26C32 7.163 24.837 0 16 0z" fill="#ef4444"/>
          <circle cx="16" cy="15" r="7" fill="white"/>
          <circle cx="16" cy="15" r="3.5" fill="#ef4444"/>
        </svg>
        <div style="font-size:11px;font-weight:600;color:white;background:rgba(0,0,0,0.7);padding:2px 8px;border-radius:4px;margin-top:4px;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis;" class="search-marker-label"></div>
      </div>
    `;
    markerEl.style.display = "none";
    document.body.appendChild(markerEl);
    searchMarkerElRef.current = markerEl;

    const searchMarkerOverlay = new Overlay({
      element: markerEl,
      positioning: "top-center",
      stopEvent: false,
    });
    map.addOverlay(searchMarkerOverlay);
    searchMarkerRef.current = searchMarkerOverlay;

    map.on("moveend", () => {
      const view = map.getView();
      const zoom = view.getZoom() || 11;
      const extent = view.calculateExtent(map.getSize());
      const bl = toLonLat([extent[0], extent[1]]);
      const tr = toLonLat([extent[2], extent[3]]);
      onViewChangeRef.current({ zoom: Math.round(zoom), bbox: [bl[0], bl[1], tr[0], tr[1]] });
    });

    map.on("pointermove", (e) => {
      const coord = toLonLat(e.coordinate);
      onSetCursorCoord([coord[0], coord[1]]);
    });

    map.on("click", (e) => {
      const coord = toLonLat(e.coordinate);
      onMapClickRef.current?.(coord[0], coord[1]);

      if (searchMarkerRef.current?.getPosition()) {
        searchMarkerRef.current.setPosition(undefined);
        if (searchMarkerElRef.current) searchMarkerElRef.current.style.display = "none";
      }

      let clicked = false;
      map.forEachFeatureAtPixel(e.pixel, (feature) => {
        if (clicked) return;
        clicked = true;
        const props = { ...feature.getProperties() };
        delete props.geometry;
        const name = props.name || props._id || props.id || "Feature";
        onSetPopupContent({ name, props });
        onPopupPosition(e.coordinate);
      });

      if (!clicked) {
        onSetPopupContent(null);
        onPopupPosition(undefined);
      }
    });

    mapInstance.current = map;

    return () => {
      map.setTarget(undefined);
      mapInstance.current = null;
      if (searchMarkerElRef.current) {
        searchMarkerElRef.current.remove();
        searchMarkerElRef.current = null;
      }
    };
  }, []);

  return {
    mapRef, popupRef,
    mapInstance, baseTileLayerRef, highlightLayerRef, radiusLayerRef,
    overlayRef, searchMarkerRef, searchMarkerElRef,
  };
}
