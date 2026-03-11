import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import OlMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import GeoJSON from "ol/format/GeoJSON";
import { fromLonLat, toLonLat, transformExtent } from "ol/proj";
import { Style, Fill, Stroke, Circle as CircleStyle, Text as TextStyle } from "ol/style";
import { Feature as OlFeature } from "ol";
import { Point, Circle as CircleGeom, Polygon as OlPolygon } from "ol/geom";
import Overlay from "ol/Overlay";
import { defaults as defaultControls } from "ol/control";
import DragBox from "ol/interaction/DragBox";
import { platformModifierKeyOnly, always } from "ol/events/condition";
import type { Layer, Feature, Basemap } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCoordinate } from "@/lib/mapUtils";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Search, MapPin, Plus, Minus, AlertTriangle, Layers, BoxSelect, MousePointer } from "lucide-react";

interface MapViewerProps {
  layers: Layer[];
  selectedLayerId: string | null;
  activeTool: string;
  onMapClick?: (lng: number, lat: number) => void;
  onBoxSelect?: (bbox: [number, number, number, number]) => void;
  onBboxChange?: (bbox: number[]) => void;
  onZoomChange?: (zoom: number) => void;
  radiusCenter?: { lng: number; lat: number } | null;
  radiusKm?: number;
  searchResults?: any | null;
}

function createTileSource(basemap: Basemap): { source: OSM | XYZ; error: string | null } {
  if (basemap.provider === "osm" && basemap.urlTemplate === "https://tile.openstreetmap.org/{z}/{x}/{y}.png") {
    return { source: new OSM(), error: null };
  }

  if (basemap.provider === "osm" && !basemap.urlTemplate) {
    return { source: new OSM(), error: null };
  }

  if (basemap.provider === "esri") {
    const xyzSource = new XYZ({
      url: basemap.urlTemplate,
      maxZoom: basemap.maxZoom,
      attributions: basemap.attribution || undefined,
    });
    return { source: xyzSource, error: null };
  }

  if (basemap.provider === "naver") {
    return { source: new OSM(), error: "네이버 지도: NCP 인증 설정이 필요합니다. NCP 콘솔에서 Client ID와 Web 서비스 URL을 확인하세요." };
  }

  if (basemap.provider === "kakao") {
    return { source: new OSM(), error: null };
  }

  let url = basemap.urlTemplate;
  if (!url) {
    return { source: new OSM(), error: `${basemap.name}: 타일 URL이 설정되지 않았습니다. 설정에서 URL 템플릿을 입력하세요.` };
  }

  if (url.includes("{apiKey}")) {
    if (!basemap.apiKey) {
      return { source: new OSM(), error: `${basemap.name}: API 키가 입력되지 않았습니다. 설정에서 API 키를 입력하세요.` };
    }
    url = url.replace("{apiKey}", basemap.apiKey);
  }

  const xyzSource = new XYZ({
    url,
    maxZoom: basemap.maxZoom,
    attributions: basemap.attribution || undefined,
  });

  return { source: xyzSource, error: null };
}

function kakaoZoomFromOl(olZoom: number): number {
  const level = Math.max(1, Math.min(14, Math.round(21 - olZoom)));
  return level;
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

function getRegionStyle(count: number, layer: Layer) {
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

function getClusterStyle(count: number) {
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

function getBoundaryCircleStyle(count: number, name: string, layer: Layer, level: string) {
  if (count === 0) return new Style();
  const baseColor = layer.strokeColor || "#0d9488";
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);
  const isSido = level === "시도";
  const logCount = Math.log10(Math.max(count, 1));
  const radius = isSido
    ? Math.min(25 + logCount * 8, 55)
    : Math.min(18 + logCount * 6, 45);
  const countText = count > 99999 ? `${(count / 1000).toFixed(0)}k` : count > 9999 ? `${(count / 1000).toFixed(1)}k` : count > 999 ? `${(count / 1000).toFixed(1)}k` : count.toString();
  const fontSize = isSido ? Math.max(11, Math.min(radius * 0.35, 16)) : Math.max(10, Math.min(radius * 0.38, 14));

  return new Style({
    image: new CircleStyle({
      radius: radius,
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

function getApproxScale(zoom: number): string {
  const scaleMap: Record<number, string> = {
    2: "150,000,000",
    3: "70,000,000",
    4: "35,000,000",
    5: "15,000,000",
    6: "10,000,000",
    7: "4,000,000",
    8: "2,000,000",
    9: "1,000,000",
    10: "500,000",
    11: "250,000",
    12: "150,000",
    13: "70,000",
    14: "35,000",
    15: "15,000",
    16: "8,000",
    17: "4,000",
    18: "2,000",
    19: "1,000",
    20: "500",
  };
  return scaleMap[zoom] || scaleMap[Math.min(20, Math.max(2, Math.round(zoom)))] || "N/A";
}

export function MapViewer({
  layers: layerList,
  selectedLayerId,
  activeTool,
  onMapClick,
  onBoxSelect,
  onBboxChange,
  onZoomChange,
  radiusCenter,
  radiusKm,
  searchResults: externalSearchResults,
}: MapViewerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const kakaoMapDivRef = useRef<HTMLDivElement>(null);
  const kakaoMapInstanceRef = useRef<any>(null);
  const kakaoSdkReadyRef = useRef(false);
  const mapInstance = useRef<OlMap | null>(null);
  const baseTileLayerRef = useRef<TileLayer | null>(null);
  const vectorLayersRef = useRef<Map<string, VectorLayer<VectorSource>>>(new Map());
  const layerRequestVersionRef = useRef<Map<string, number>>(new Map());
  const highlightLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const radiusLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const selectionLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const dragBoxRef = useRef<DragBox | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const searchMarkerRef = useRef<Overlay | null>(null);
  const searchMarkerElRef = useRef<HTMLDivElement | null>(null);
  const [currentZoom, setCurrentZoom] = useState(11);
  const [cursorCoord, setCursorCoord] = useState<[number, number] | null>(null);
  const [popupContent, setPopupContent] = useState<{ name: string; props: Record<string, any> } | null>(null);
  const [basemapError, setBasemapError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [geocodeResults, setGeocodeResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [basemapPickerOpen, setBasemapPickerOpen] = useState(false);
  const [mapToolMode, setMapToolMode] = useState<"select" | "boxSelect">("select");
  const tileErrorCountRef = useRef(0);
  const prevVisibleIdsRef = useRef<Set<string>>(new Set());

  const { data: basemapList = [] } = useQuery<Basemap[]>({
    queryKey: ["/api/basemaps"],
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/basemaps/${id}/default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/basemaps"] });
    },
  });

  const enabledBasemaps = basemapList.filter(b => b.enabled);
  const activeBasemap = enabledBasemaps.find(b => b.isDefault)
    || enabledBasemaps[0];

  useEffect(() => {
    if (!mapRef.current) return;

    const tileLayer = new TileLayer({
      source: new OSM(),
      zIndex: 0,
    });
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

      if (searchMarkerRef.current?.getPosition()) {
        searchMarkerRef.current.setPosition(undefined);
        if (searchMarkerElRef.current) searchMarkerElRef.current.style.display = "none";
      }

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
      if (searchMarkerElRef.current) {
        searchMarkerElRef.current.remove();
        searchMarkerElRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    const target = mapInstance.current.getTargetElement();
    if (target) {
      (target as HTMLElement).style.cursor = mapToolMode === "boxSelect" ? "crosshair" : (activeTool === "radius" ? "crosshair" : "default");
    }
  }, [activeTool, mapToolMode]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    if (dragBoxRef.current) {
      map.removeInteraction(dragBoxRef.current);
      dragBoxRef.current = null;
    }

    if (mapToolMode !== "boxSelect") {
      if (selectionLayerRef.current) {
        map.removeLayer(selectionLayerRef.current);
        selectionLayerRef.current = null;
      }
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
        const poly = new OlPolygon([[
          [extent[0], extent[1]],
          [extent[2], extent[1]],
          [extent[2], extent[3]],
          [extent[0], extent[3]],
          [extent[0], extent[1]],
        ]]);
        const feat = new OlFeature({ geometry: poly });
        src.addFeature(feat);
      }

      onBoxSelect?.([minX, minY, maxX, maxY]);
    });

    return () => {
      if (dragBoxRef.current) {
        map.removeInteraction(dragBoxRef.current);
        dragBoxRef.current = null;
      }
    };
  }, [mapToolMode, onBoxSelect]);

  useEffect(() => {
    if (!baseTileLayerRef.current || !activeBasemap) return;
    const { source, error } = createTileSource(activeBasemap);
    setBasemapError(error);
    tileErrorCountRef.current = 0;

    if (source instanceof XYZ && !(source instanceof OSM)) {
      const onTileError = () => {
        tileErrorCountRef.current++;
        if (tileErrorCountRef.current === 3) {
          setBasemapError(`${activeBasemap.name}: 타일 로드 실패. URL 또는 API 키를 확인하세요.`);
        }
      };
      const onTileLoad = () => {
        if (tileErrorCountRef.current >= 3) {
          tileErrorCountRef.current = 0;
          setBasemapError(null);
        }
      };
      source.on("tileloaderror", onTileError);
      source.on("tileloadend", onTileLoad);

      baseTileLayerRef.current.setSource(source);

      return () => {
        source.un("tileloaderror", onTileError);
        source.un("tileloadend", onTileLoad);
      };
    }

    baseTileLayerRef.current.setSource(source);
  }, [activeBasemap]);

  useEffect(() => {
    const isKakao = activeBasemap?.provider === "kakao";
    const kakaoDiv = kakaoMapDivRef.current;
    const olMap = mapInstance.current;

    if (!kakaoDiv || !olMap) return;

    if (!isKakao) {
      kakaoDiv.style.display = "none";
      if (baseTileLayerRef.current) {
        baseTileLayerRef.current.setVisible(true);
      }
      const olViewport = mapRef.current?.querySelector(".ol-viewport") as HTMLElement | null;
      if (olViewport) {
        olViewport.style.background = "";
      }
      return;
    }

    kakaoDiv.style.display = "block";
    if (baseTileLayerRef.current) {
      baseTileLayerRef.current.setVisible(false);
    }
    const olViewport = mapRef.current?.querySelector(".ol-viewport") as HTMLElement | null;
    if (olViewport) {
      olViewport.style.background = "transparent";
    }

    let disposed = false;

    const initKakaoMap = () => {
      const kakao = (window as any).kakao;
      if (!kakao?.maps || disposed) return;

      if (!kakaoSdkReadyRef.current) {
        kakao.maps.load(() => {
          if (disposed) return;
          kakaoSdkReadyRef.current = true;
          createKakaoMap();
        });
      } else {
        createKakaoMap();
      }
    };

    const createKakaoMap = () => {
      if (disposed) return;
      const kakao = (window as any).kakao;
      if (!kakao?.maps?.LatLng) return;

      const view = olMap.getView();
      const center = toLonLat(view.getCenter()!);
      const zoom = Math.round(view.getZoom()!);

      if (kakaoMapInstanceRef.current) {
        const kCenter = new kakao.maps.LatLng(center[1], center[0]);
        kakaoMapInstanceRef.current.setCenter(kCenter);
        kakaoMapInstanceRef.current.setLevel(kakaoZoomFromOl(zoom));
        requestAnimationFrame(() => {
          if (!disposed && kakaoMapInstanceRef.current) {
            kakaoMapInstanceRef.current.relayout();
          }
        });
        return;
      }

      const container = kakaoMapDivRef.current!;
      const options = {
        center: new kakao.maps.LatLng(center[1], center[0]),
        level: kakaoZoomFromOl(zoom),
        draggable: false,
        scrollwheel: false,
        disableDoubleClick: true,
        disableDoubleClickZoom: true,
      };
      const kMap = new kakao.maps.Map(container, options);
      kakaoMapInstanceRef.current = kMap;
      requestAnimationFrame(() => {
        if (!disposed && kakaoMapInstanceRef.current) {
          kakaoMapInstanceRef.current.relayout();
          const c = toLonLat(olMap.getView().getCenter()!);
          kMap.setCenter(new kakao.maps.LatLng(c[1], c[0]));
          kMap.setLevel(kakaoZoomFromOl(Math.round(olMap.getView().getZoom()!)));
        }
      });
    };

    initKakaoMap();

    const syncKakaoView = () => {
      if (disposed) return;
      const kMap = kakaoMapInstanceRef.current;
      const kakao = (window as any).kakao;
      if (!kMap || !kakao?.maps) return;

      const view = olMap.getView();
      const center = toLonLat(view.getCenter()!);
      const zoom = Math.round(view.getZoom()!);
      const kCenter = new kakao.maps.LatLng(center[1], center[0]);
      kMap.setCenter(kCenter);
      kMap.setLevel(kakaoZoomFromOl(zoom));
    };

    const view = olMap.getView();
    view.on("change:center", syncKakaoView);
    view.on("change:resolution", syncKakaoView);

    const handleResize = () => {
      if (disposed) return;
      const kMap = kakaoMapInstanceRef.current;
      if (kMap) {
        kMap.relayout();
        syncKakaoView();
      }
    };
    const resizeObserver = new ResizeObserver(handleResize);
    if (kakaoDiv) resizeObserver.observe(kakaoDiv);

    return () => {
      disposed = true;
      view.un("change:center", syncKakaoView);
      view.un("change:resolution", syncKakaoView);
      resizeObserver.disconnect();
    };
  }, [activeBasemap]);

  const getZoomTier = useCallback((layer: Layer, zoom: number): "sido" | "sigungu" | "eupmyeondong" | "cluster" | "feature" => {
    if (layer.renderMode === "feature") return "feature";

    if (layer.geometryType === "Point" && layer.featureCount > 100) {
      if (zoom <= 11) return "sido";
      if (zoom <= 13) return "sigungu";
      if (zoom <= 16) return "eupmyeondong";
      if (zoom <= 17) return "cluster";
      return "feature";
    }

    if (layer.featureCount > 100 && zoom < layer.minZoomForFeatures) return "cluster";
    return "feature";
  }, []);

  const fetchAndRenderLayer = useCallback(async (layer: Layer) => {
    if (!mapInstance.current) return;

    const map = mapInstance.current;
    const existingLayer = vectorLayersRef.current.get(layer.id);

    const version = (layerRequestVersionRef.current.get(layer.id) || 0) + 1;
    layerRequestVersionRef.current.set(layer.id, version);

    if (!layer.visible) {
      if (existingLayer) {
        existingLayer.setVisible(false);
        existingLayer.getSource()?.clear();
      }
      return;
    }

    const view = map.getView();
    const extent = view.calculateExtent(map.getSize());
    const bl = toLonLat([extent[0], extent[1]]);
    const tr = toLonLat([extent[2], extent[3]]);
    const bbox = `${bl[0]},${bl[1]},${tr[0]},${tr[1]}`;
    const zoom = view.getZoom() || 11;
    const tier = getZoomTier(layer, zoom);

    try {
      if (tier === "sido" || tier === "sigungu" || tier === "eupmyeondong") {
        const level = tier === "sido" ? "시도" : tier === "sigungu" ? "시군구" : "읍면동";
        const res = await fetch(`/api/layers/${layer.id}/boundary-aggregate?bbox=${bbox}&level=${encodeURIComponent(level)}`);
        if (layerRequestVersionRef.current.get(layer.id) !== version) return;
        const boundaryData = await res.json();

        const source = new VectorSource();
        boundaryData.forEach((b: { boundaryId: string; name: string; code: string; count: number; centerLng: number; centerLat: number }) => {
          if (b.count === 0) return;
          const feature = new OlFeature({
            geometry: new Point(fromLonLat([b.centerLng, b.centerLat])),
            count: b.count,
            name: b.name,
            boundaryId: b.boundaryId,
          });
          feature.setStyle(getBoundaryCircleStyle(b.count, b.name, layer, level));
          source.addFeature(feature);
        });

        if (layerRequestVersionRef.current.get(layer.id) !== version) return;

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
      } else if (tier === "cluster") {
        const res = await fetch(`/api/layers/${layer.id}/aggregate?bbox=${bbox}&gridSize=8`);
        if (layerRequestVersionRef.current.get(layer.id) !== version) return;
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

        if (layerRequestVersionRef.current.get(layer.id) !== version) return;

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
        if (layerRequestVersionRef.current.get(layer.id) !== version) return;
        const geojson = await res.json();

        const source = new VectorSource({
          features: geojsonFormat.readFeatures(geojson, {
            featureProjection: "EPSG:3857",
          }),
        });

        const style = getLayerStyle(layer);

        if (layerRequestVersionRef.current.get(layer.id) !== version) return;

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
  }, [getZoomTier]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!mapInstance.current) return;

    const currentLayerIds = new Set(layerList.map(l => l.id));
    vectorLayersRef.current.forEach((vl, id) => {
      if (!currentLayerIds.has(id)) {
        mapInstance.current?.removeLayer(vl);
        vectorLayersRef.current.delete(id);
      }
    });

    layerList.forEach(layer => {
      const existingLayer = vectorLayersRef.current.get(layer.id);
      if (!layer.visible && existingLayer) {
        existingLayer.setVisible(false);
        existingLayer.getSource()?.clear();
      }
    });

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      layerList.forEach(layer => {
        if (layer.visible) {
          fetchAndRenderLayer(layer);
        }
      });
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [layerList, currentZoom, fetchAndRenderLayer]);

  useEffect(() => {
    if (!mapInstance.current) return;

    const currentVisibleIds = new Set(
      layerList.filter(l => l.visible).map(l => l.id)
    );
    const prevIds = prevVisibleIdsRef.current;

    const hasNewLayer = [...currentVisibleIds].some(id => !prevIds.has(id));

    prevVisibleIdsRef.current = currentVisibleIds;

    if (!hasNewLayer) return;

    const visibleWithBounds = layerList.filter(
      l => l.visible && l.bounds && l.bounds.length === 4
    );

    if (visibleWithBounds.length === 0) return;

    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const layer of visibleWithBounds) {
      const [lngMin, latMin, lngMax, latMax] = layer.bounds!;
      if (lngMin < minLng) minLng = lngMin;
      if (latMin < minLat) minLat = latMin;
      if (lngMax > maxLng) maxLng = lngMax;
      if (latMax > maxLat) maxLat = latMax;
    }

    const extent = transformExtent(
      [minLng, minLat, maxLng, maxLat],
      "EPSG:4326",
      "EPSG:3857"
    );

    mapInstance.current.getView().fit(extent, {
      padding: [50, 50, 50, 50],
      duration: 500,
      maxZoom: 16,
    });
  }, [layerList]);

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

    if (externalSearchResults && externalSearchResults.features) {
      const features = geojsonFormat.readFeatures(externalSearchResults, {
        featureProjection: "EPSG:3857",
      });
      source.addFeatures(features);
    }
  }, [externalSearchResults]);

  const handleZoomIn = useCallback(() => {
    if (!mapInstance.current) return;
    const view = mapInstance.current.getView();
    const zoom = view.getZoom();
    if (zoom !== undefined) {
      view.animate({ zoom: Math.min(zoom + 1, 20), duration: 200 });
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!mapInstance.current) return;
    const view = mapInstance.current.getView();
    const zoom = view.getZoom();
    if (zoom !== undefined) {
      view.animate({ zoom: Math.max(zoom - 1, 2), duration: 200 });
    }
  }, []);

  const showSearchMarker = useCallback((lat: number, lng: number, label?: string) => {
    if (!searchMarkerRef.current || !searchMarkerElRef.current) return;
    const coord = fromLonLat([lng, lat]);
    searchMarkerRef.current.setPosition(coord);
    searchMarkerElRef.current.style.display = "block";
    const labelEl = searchMarkerElRef.current.querySelector(".search-marker-label") as HTMLElement;
    if (labelEl) {
      labelEl.textContent = label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }, []);

  const hideSearchMarker = useCallback(() => {
    if (!searchMarkerRef.current || !searchMarkerElRef.current) return;
    searchMarkerRef.current.setPosition(undefined);
    searchMarkerElRef.current.style.display = "none";
  }, []);

  const moveToLocation = useCallback((lat: number, lng: number, zoom = 15, label?: string) => {
    if (!mapInstance.current) return;
    const view = mapInstance.current.getView();
    view.animate({ center: fromLonLat([lng, lat]), zoom, duration: 500 });
    showSearchMarker(lat, lng, label);
  }, [showSearchMarker]);

  const searchByGeocode = useCallback(async (query: string) => {
    setSearchLoading(true);
    setShowSearchResults(true);
    try {
      const params = new URLSearchParams({
        q: query,
        format: "json",
        limit: "5",
        addressdetails: "1",
        "accept-language": "ko",
        countrycodes: "kr",
      });
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "User-Agent": "GIS-Solution/1.0" },
      });
      if (!resp.ok) throw new Error("Geocoding failed");
      const data = await resp.json();
      setGeocodeResults(data);
      if (data.length === 1) {
        const name = data[0].display_name.split(",")[0];
        moveToLocation(parseFloat(data[0].lat), parseFloat(data[0].lon), 15, name);
        setShowSearchResults(false);
        setSearchQuery(name);
      }
    } catch {
      setGeocodeResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [moveToLocation]);

  const handleSearchGo = useCallback(() => {
    if (!mapInstance.current || !searchQuery.trim()) return;
    const q = searchQuery.trim();
    const coordMatch = q.match(/^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const a = parseFloat(coordMatch[1]);
      const b = parseFloat(coordMatch[2]);
      let lng: number, lat: number;
      if (Math.abs(a) <= 90 && Math.abs(b) > 90) {
        lat = a; lng = b;
      } else if (Math.abs(b) <= 90 && Math.abs(a) > 90) {
        lng = a; lat = b;
      } else {
        lat = a; lng = b;
      }
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        moveToLocation(lat, lng, 15, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setSearchQuery("");
        setShowSearchResults(false);
        return;
      }
    }
    searchByGeocode(q);
  }, [searchQuery, moveToLocation, searchByGeocode]);

  const handleSelectResult = useCallback((result: { display_name: string; lat: string; lon: string }) => {
    const name = result.display_name.split(",")[0];
    moveToLocation(parseFloat(result.lat), parseFloat(result.lon), 15, name);
    setSearchQuery(name);
    setShowSearchResults(false);
    setGeocodeResults([]);
  }, [moveToLocation]);

  return (
    <div className="relative w-full h-full">
      <div ref={kakaoMapDivRef} className="absolute inset-0 z-[0]" style={{ display: "none" }} data-testid="kakao-map-container" />
      <div ref={mapRef} className="absolute inset-0 z-[1]" data-testid="map-container" />

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

      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-full max-w-md px-4">
        <form onSubmit={(e) => { e.preventDefault(); handleSearchGo(); }} className="flex items-center gap-1 bg-black/60 backdrop-blur-md rounded-md border border-white/10 px-2">
          <Search className="w-4 h-4 text-white/60 flex-shrink-0" />
          <Input
            type="text"
            placeholder="주소, 지명 또는 좌표 검색..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value.trim()) {
                setShowSearchResults(false);
                setGeocodeResults([]);
              }
            }}
            onFocus={() => { if (geocodeResults.length > 0) setShowSearchResults(true); }}
            className="border-0 bg-transparent text-white placeholder:text-white/40 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            data-testid="input-map-search"
          />
          {searchLoading ? (
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
            </div>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              type="submit"
              className="text-white/60 hover:text-white flex-shrink-0"
              data-testid="button-map-pin"
            >
              <MapPin className="w-4 h-4" />
            </Button>
          )}
        </form>

        {showSearchResults && geocodeResults.length > 0 && (
          <div className="mt-1 bg-black/80 backdrop-blur-md rounded-md border border-white/10 overflow-hidden" data-testid="search-results-dropdown">
            {geocodeResults.map((result, idx) => (
              <button
                key={idx}
                className="w-full text-left px-3 py-2.5 text-sm text-white/90 hover:bg-white/10 transition-colors flex items-start gap-2 border-b border-white/5 last:border-0"
                onClick={() => handleSelectResult(result)}
                data-testid={`search-result-${idx}`}
              >
                <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2 text-xs leading-relaxed">{result.display_name}</span>
              </button>
            ))}
          </div>
        )}

        {showSearchResults && !searchLoading && geocodeResults.length === 0 && searchQuery.trim() && (
          <div className="mt-1 bg-black/80 backdrop-blur-md rounded-md border border-white/10 px-3 py-3" data-testid="search-no-results">
            <p className="text-xs text-white/50 text-center">검색 결과가 없습니다</p>
          </div>
        )}
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setMapToolMode("select");
            if (selectionLayerRef.current) {
              selectionLayerRef.current.getSource()?.clear();
            }
            onBoxSelect?.(undefined as any);
          }}
          className={`w-8 h-8 backdrop-blur-sm border border-white/10 ${mapToolMode === "select" ? "bg-cyan-600/60 text-white" : "bg-black/60 text-white/70 hover:text-white"}`}
          data-testid="button-tool-select"
          title="이동/선택"
        >
          <MousePointer className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setMapToolMode("boxSelect")}
          className={`w-8 h-8 backdrop-blur-sm border border-white/10 ${mapToolMode === "boxSelect" ? "bg-cyan-600/60 text-white" : "bg-black/60 text-white/70 hover:text-white"}`}
          data-testid="button-tool-box-select"
          title="영역 선택"
        >
          <BoxSelect className="w-4 h-4" />
        </Button>
      </div>

      <div className="absolute bottom-3 right-3 z-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-md px-2.5 py-1 flex items-center gap-2">
          <span className="text-[10px] font-mono text-white/70" data-testid="text-zoom-level">Z{currentZoom}</span>
          <span className="text-[10px] font-mono text-cyan-400 font-bold" data-testid="text-scale-ratio">1:{getApproxScale(currentZoom)}</span>
          {cursorCoord && (
            <span className="text-[10px] font-mono text-white/50">
              {formatCoordinate(cursorCoord[1], "lat")}, {formatCoordinate(cursorCoord[0], "lng")}
            </span>
          )}
        </div>
      </div>

      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={handleZoomIn}
          className="bg-black/60 backdrop-blur-sm text-white/80 hover:text-white border border-white/10"
          data-testid="button-zoom-in"
        >
          <Plus className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleZoomOut}
          className="bg-black/60 backdrop-blur-sm text-white/80 hover:text-white border border-white/10"
          data-testid="button-zoom-out"
        >
          <Minus className="w-4 h-4" />
        </Button>
      </div>

      <div className="absolute bottom-3 left-3 z-10">
        <div className="relative">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setBasemapPickerOpen(!basemapPickerOpen)}
            className="bg-black/60 backdrop-blur-sm text-white/80 hover:text-white border border-white/10 text-xs gap-1.5"
            data-testid="button-basemap-picker"
          >
            <Layers className="w-3.5 h-3.5" />
            {activeBasemap?.name || "배경지도"}
          </Button>
          {basemapPickerOpen && enabledBasemaps.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 bg-black/80 backdrop-blur-md rounded-md border border-white/10 py-1 min-w-[160px]">
              {enabledBasemaps.map((bm) => (
                <button
                  key={bm.id}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    bm.id === activeBasemap?.id
                      ? "text-cyan-400 bg-white/10"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                  onClick={() => {
                    setDefaultMutation.mutate(bm.id);
                    setBasemapPickerOpen(false);
                  }}
                  data-testid={`button-select-basemap-${bm.id}`}
                >
                  {bm.name}
                </button>
              ))}
            </div>
          )}
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
