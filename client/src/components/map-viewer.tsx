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
import { fromLonLat, toLonLat } from "ol/proj";
import { Style, Fill, Stroke, Circle as CircleStyle, Text as TextStyle } from "ol/style";
import { Feature as OlFeature } from "ol";
import { Point, Circle as CircleGeom } from "ol/geom";
import Overlay from "ol/Overlay";
import { defaults as defaultControls } from "ol/control";
import type { Layer, Feature, Basemap } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCoordinate } from "@/lib/mapUtils";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Search, MapPin, Plus, Minus, AlertTriangle, Layers } from "lucide-react";

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
  const size = count <= 20
    ? 10 + Math.sqrt(count) * 7
    : 10 + Math.sqrt(20) * 7 + Math.log2(count / 20) * 6;
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
  const baseTileLayerRef = useRef<TileLayer | null>(null);
  const vectorLayersRef = useRef<Map<string, VectorLayer<VectorSource>>>(new Map());
  const highlightLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const radiusLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const [currentZoom, setCurrentZoom] = useState(11);
  const [cursorCoord, setCursorCoord] = useState<[number, number] | null>(null);
  const [popupContent, setPopupContent] = useState<{ name: string; props: Record<string, any> } | null>(null);
  const [basemapError, setBasemapError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [basemapPickerOpen, setBasemapPickerOpen] = useState(false);
  const tileErrorCountRef = useRef(0);

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
        const view = mapInstance.current.getView();
        view.animate({ center: fromLonLat([lng, lat]), zoom: 15, duration: 500 });
        setSearchQuery("");
        return;
      }
    }
  }, [searchQuery]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" data-testid="map-container" />

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
            placeholder="좌표 검색 (예: 37.5665, 126.978)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-0 bg-transparent text-white placeholder:text-white/40 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            data-testid="input-map-search"
          />
          <Button
            size="icon"
            variant="ghost"
            type="submit"
            className="text-white/60 hover:text-white flex-shrink-0"
            data-testid="button-map-pin"
          >
            <MapPin className="w-4 h-4" />
          </Button>
        </form>
      </div>

      <div className="absolute top-3 right-3 z-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-md px-2.5 py-1 flex items-center gap-2">
          <span className="text-[10px] font-mono text-white/70">Z{currentZoom}</span>
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
