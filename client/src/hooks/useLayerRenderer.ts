import { useEffect, useRef, useCallback } from "react";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import VectorTileLayer from "ol/layer/VectorTile";
import VectorTileSource from "ol/source/VectorTile";
import MVT from "ol/format/MVT";
import TileLayer from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS";
import GeoJSON from "ol/format/GeoJSON";
import { bbox as bboxStrategy } from "ol/loadingstrategy";
import { fromLonLat, toLonLat, transformExtent } from "ol/proj";
import { Feature as OlFeature } from "ol";
import { Point } from "ol/geom";
import type OlMap from "ol/Map";
import type { Layer } from "@shared/schema";
import { getLayerStyle, getClusterStyle, getBoundaryCircleStyle } from "@/lib/mapStyles";

const geojsonFormat = new GeoJSON();

export function useLayerRenderer(
  mapInstance: React.RefObject<OlMap | null>,
  layerList: Layer[],
  mapView: { zoom: number; bbox: [number, number, number, number] }
) {
  const vectorLayersRef = useRef<Map<string, VectorLayer<VectorSource>>>(new Map());
  const wmsLayersRef = useRef<Map<string, TileLayer>>(new Map());
  const wfsLayersRef = useRef<Map<string, VectorLayer<VectorSource>>>(new Map());
  const mvtLayersRef = useRef<Map<string, VectorTileLayer>>(new Map());
  const layerRequestVersionRef = useRef<Map<string, number>>(new Map());
  const prevVisibleIdsRef = useRef<Set<string>>(new Set());
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getZoomTier = useCallback((layer: Layer, zoom: number): "sido" | "sigungu" | "eupmyeondong" | "cluster" | "feature" => {
    if (layer.renderMode === "feature") return "feature";
    const z = Math.round(zoom);
    if (layer.geometryType === "Point" && layer.featureCount > 100) {
      if (z <= 11) return "sido";
      if (z <= 13) return "sigungu";
      if (z <= 15) return "eupmyeondong";
      if (z <= 17) return "cluster";
      return "feature";
    }
    if (layer.featureCount > 100 && z < layer.minZoomForFeatures) return "cluster";
    return "feature";
  }, []);

  const shouldUseMvt = useCallback((layer: Layer): boolean => {
    if (layer.wmsUrl || layer.wfsUrl) return false;
    const gtype = (layer.geometryType || "").toLowerCase();
    return (gtype.includes("polygon") || gtype.includes("line")) && (layer.featureCount ?? 0) > 1000;
  }, []);

  const isAdminBoundaryLayer = useCallback((layer: Layer): string | null => {
    const desc = layer.description || "";
    const match = desc.match(/^internal:\/\/admin-boundaries\?level=(.+)$/);
    return match ? match[1] : null;
  }, []);

  const fetchAndRenderLayer = useCallback(async (layer: Layer) => {
    if (!mapInstance.current || layer.wmsUrl || layer.wfsUrl || shouldUseMvt(layer)) return;

    const map = mapInstance.current;
    const existing = vectorLayersRef.current.get(layer.id);
    const version = (layerRequestVersionRef.current.get(layer.id) || 0) + 1;
    layerRequestVersionRef.current.set(layer.id, version);

    if (!layer.visible) {
      if (existing) { existing.setVisible(false); existing.getSource()?.clear(); }
      return;
    }

    // ── 행정경계 레이어 (internal://admin-boundaries) ──
    const boundaryLevel = isAdminBoundaryLayer(layer);
    if (boundaryLevel) {
      try {
        const res = await fetch(`/api/admin-boundaries/geojson?level=${encodeURIComponent(boundaryLevel)}`);
        if (layerRequestVersionRef.current.get(layer.id) !== version) return;
        const geojson = await res.json();
        const source = new VectorSource({
          features: geojsonFormat.readFeatures(geojson, { featureProjection: "EPSG:3857" }),
        });
        const style = getLayerStyle(layer);
        if (existing) {
          existing.setSource(source);
          existing.setStyle(style);
          existing.setVisible(true);
          existing.setOpacity(layer.opacity);
        } else {
          const vl = new VectorLayer({ source, style, zIndex: 5, opacity: layer.opacity });
          vl.setVisible(true);
          map.addLayer(vl);
          vectorLayersRef.current.set(layer.id, vl);
        }
      } catch (err) {
        console.error("Failed to load boundary layer:", boundaryLevel, err);
      }
      return;
    }

    const view = map.getView();
    const size = map.getSize();
    if (!size || size[0] === 0 || size[1] === 0) return;
    const extent = view.calculateExtent(size);
    const bl = toLonLat([extent[0], extent[1]]);
    const tr = toLonLat([extent[2], extent[3]]);
    const bbox = `${bl[0]},${bl[1]},${tr[0]},${tr[1]}`;
    const zoom = view.getZoom() || 11;
    const tier = getZoomTier(layer, zoom);

    // tier 전환 시 겹침은 setLayer에서 source 교체로 해결 — fetch 전 clear 제거 (빈 화면 방지)

    // 격자 칸 크기를 ≈300m(≈0.0027°)로 고정, 뷰포트 폭에 맞춰 격자 수 계산
    const bboxWidthDeg = tr[0] - bl[0];
    const targetCellDeg = 0.0027;
    const dynamicGridSize = Math.max(3, Math.min(20, Math.round(bboxWidthDeg / targetCellDeg)));

    // clearStyle=true: feature-level 스타일 사용 시 레이어 style 초기화 필요
    const setLayer = (source: VectorSource, clearStyle = false) => {
      if (layerRequestVersionRef.current.get(layer.id) !== version) return;
      if (existing) {
        existing.setSource(source);
        if (clearStyle) existing.setStyle(undefined as any);
        existing.setVisible(true);
        existing.setOpacity(layer.opacity);
      } else {
        const vl = new VectorLayer({ source, zIndex: 10 });
        vl.setOpacity(layer.opacity);
        map.addLayer(vl);
        vectorLayersRef.current.set(layer.id, vl);
      }
    };

    try {
      if (tier === "sido" || tier === "sigungu" || tier === "eupmyeondong") {
        const level = tier === "sido" ? "시도" : tier === "sigungu" ? "시군구" : "읍면동";
        const res = await fetch(`/api/layers/${layer.id}/boundary-aggregate?bbox=${bbox}&level=${encodeURIComponent(level)}`);
        if (layerRequestVersionRef.current.get(layer.id) !== version) return;
        const data = await res.json();

        const source = new VectorSource();
        const maxCount = Math.max(...data.map((b: any) => b.count), 1);
        data.forEach((b: any) => {
          if (b.count === 0) return;
          const f = new OlFeature({
            geometry: new Point(fromLonLat([b.centerLng, b.centerLat])),
            count: b.count, name: b.name, boundaryId: b.boundaryId,
          });
          f.setStyle(getBoundaryCircleStyle(b.count, maxCount, b.name, layer, level));
          source.addFeature(f);
        });
        setLayer(source, true); // feature-level 스타일 → 레이어 style 초기화

      } else if (tier === "cluster") {
        const res = await fetch(`/api/layers/${layer.id}/aggregate?bbox=${bbox}&gridSize=${dynamicGridSize}`);
        if (layerRequestVersionRef.current.get(layer.id) !== version) return;
        const data = await res.json();

        const source = new VectorSource();
        data.forEach((cell: any) => {
          const f = new OlFeature({
            geometry: new Point(fromLonLat([cell.lng, cell.lat])),
            count: cell.count, name: `${cell.count} features`,
          });
          f.setStyle(getClusterStyle(cell.count));
          source.addFeature(f);
        });
        setLayer(source, true); // feature-level 스타일 → 레이어 style 초기화

      } else {
        const res = await fetch(`/api/layers/${layer.id}/features?bbox=${bbox}&limit=${layer.featureLimit}&zoom=${Math.round(zoom)}`);
        if (layerRequestVersionRef.current.get(layer.id) !== version) return;
        const geojson = await res.json();

        const source = new VectorSource({
          features: geojsonFormat.readFeatures(geojson, { featureProjection: "EPSG:3857" }),
        });
        if (layerRequestVersionRef.current.get(layer.id) !== version) return;

        const style = getLayerStyle(layer);
        if (existing) {
          existing.setSource(source);
          existing.setStyle(style); // 레이어 level 스타일 복원
          existing.setVisible(true);
          existing.setOpacity(layer.opacity);
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

  // Layer sync + fetch
  useEffect(() => {
    if (!mapInstance.current) return;

    const currentIds = new Set(layerList.map(l => l.id));

    vectorLayersRef.current.forEach((vl, id) => {
      if (!currentIds.has(id)) { mapInstance.current?.removeLayer(vl); vectorLayersRef.current.delete(id); }
    });
    wmsLayersRef.current.forEach((tl, id) => {
      if (!currentIds.has(id)) { mapInstance.current?.removeLayer(tl); wmsLayersRef.current.delete(id); }
    });
    wfsLayersRef.current.forEach((vl, id) => {
      if (!currentIds.has(id)) { mapInstance.current?.removeLayer(vl); wfsLayersRef.current.delete(id); }
    });
    mvtLayersRef.current.forEach((vl, id) => {
      if (!currentIds.has(id)) { mapInstance.current?.removeLayer(vl); mvtLayersRef.current.delete(id); }
    });

    // ── MVT 벡터 타일 레이어 ──
    layerList.forEach(layer => {
      if (!shouldUseMvt(layer)) return;
      const existingMvt = mvtLayersRef.current.get(layer.id);
      if (existingMvt) {
        existingMvt.setVisible(layer.visible);
        existingMvt.setOpacity(layer.opacity);
      } else if (layer.visible) {
        const mvtSource = new VectorTileSource({
          format: new MVT(),
          url: `/api/layers/${layer.id}/tiles/{z}/{x}/{y}.pbf`,
          maxZoom: 18,
        });
        const style = getLayerStyle(layer);
        const mvtLayer = new VectorTileLayer({
          source: mvtSource,
          style,
          zIndex: 10,
          opacity: layer.opacity,
        });
        mapInstance.current?.addLayer(mvtLayer);
        mvtLayersRef.current.set(layer.id, mvtLayer);
      }
    });

    layerList.forEach(layer => {
      if (!layer.wfsUrl || !layer.wfsLayers) return;
      const existingWfs = wfsLayersRef.current.get(layer.id);
      if (existingWfs) {
        existingWfs.setVisible(layer.visible);
        existingWfs.setOpacity(layer.opacity);
      } else {
        const wfsTypeName = layer.wfsLayers;
        const wfsSource = new VectorSource({
          format: new GeoJSON(),
          loader: (extent, _resolution, projection, success, failure) => {
            const [minLon, minLat, maxLon, maxLat] = transformExtent(extent, projection, "EPSG:4326");
            // WFS 1.1.0 + EPSG:4326: 축 순서가 lat,lon (VWorld 표준)
            const params = new URLSearchParams({
              SERVICE: "WFS",
              VERSION: "1.1.0",
              REQUEST: "GetFeature",
              TYPENAME: wfsTypeName,
              BBOX: `${minLat},${minLon},${maxLat},${maxLon},EPSG:4326`,
              SRSNAME: "EPSG:4326",
              OUTPUTFORMAT: "application/json",
              MAXFEATURES: "500",
            });
            fetch(`/api/proxy/wfs?${params.toString()}`)
              .then(r => {
                if (!r.ok) throw new Error(`WFS proxy error: ${r.status}`);
                return r.json();
              })
              .then(data => {
                // VWorld WFS 응답에 urn:ogc:def:crs:EPSG::4326 CRS가 포함되어
                // OL이 좌표축 해석을 잘못할 수 있으므로 제거
                if (data.crs) delete data.crs;
                const features = new GeoJSON().readFeatures(data, {
                  dataProjection: "EPSG:4326",
                  featureProjection: "EPSG:3857",
                });
                // bbox 전환 시 이전 features 제거 → 메모리 누수 방지
                wfsSource.clear(true);
                wfsSource.addFeatures(features);
                success?.(features);
              })
              .catch((err) => {
                console.error(`[WFS] ${layer.name} load failed:`, err);
                failure?.();
              });
          },
          strategy: bboxStrategy,
        });
        const style = getLayerStyle(layer);
        // minZoom - 0.5: OL은 소수점 줌을 사용하므로, 정수 줌 전환 직전에도 보이도록 여유
        const wfsMinZoom = (layer.minZoomForFeatures ?? 11) - 0.5;
        const vl = new VectorLayer({ source: wfsSource, style, zIndex: 8, opacity: layer.opacity, minZoom: wfsMinZoom });
        vl.setVisible(layer.visible);
        mapInstance.current?.addLayer(vl);
        wfsLayersRef.current.set(layer.id, vl);
      }
    });

    layerList.forEach(layer => {
      if (!layer.wmsUrl || !layer.wmsLayers) return;
      const existing = wmsLayersRef.current.get(layer.id);
      if (existing) {
        existing.setVisible(layer.visible);
        existing.setOpacity(layer.opacity);
      } else {
        const wmsSource = new TileWMS({
          url: "/api/proxy/wms",
          params: { LAYERS: layer.wmsLayers, FORMAT: "image/png", TRANSPARENT: "TRUE", VERSION: "1.3.0", CRS: "EPSG:4326" },
          crossOrigin: "anonymous",
        });
        // minZoom - 0.5: OL은 소수점 줌을 사용하므로, 정수 줌 전환 직전에도 보이도록 여유
        const wmsMinZoom = (layer.minZoomForFeatures ?? 11) - 0.5;
        const tl = new TileLayer({ source: wmsSource, zIndex: 9, opacity: layer.opacity, minZoom: wmsMinZoom });
        tl.setVisible(layer.visible);
        mapInstance.current?.addLayer(tl);
        wmsLayersRef.current.set(layer.id, tl);
      }
    });

    layerList.forEach(layer => {
      if (layer.wmsUrl || shouldUseMvt(layer)) return;
      const existing = vectorLayersRef.current.get(layer.id);
      if (!layer.visible && existing) {
        const v = (layerRequestVersionRef.current.get(layer.id) || 0) + 1;
        layerRequestVersionRef.current.set(layer.id, v);
        existing.setVisible(false);
        existing.getSource()?.clear();
      }
    });

    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => {
      layerList.forEach(layer => { if (layer.visible) fetchAndRenderLayer(layer); });
    }, 300);

    return () => {
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    };
  }, [layerList, mapView, fetchAndRenderLayer]);

  // Cleanup: unmount 시 모든 OL 레이어 제거
  useEffect(() => {
    return () => {
      const map = mapInstance.current;
      if (!map) return;
      vectorLayersRef.current.forEach(vl => { map.removeLayer(vl); vl.getSource()?.clear(); });
      wmsLayersRef.current.forEach(tl => map.removeLayer(tl));
      wfsLayersRef.current.forEach(vl => { map.removeLayer(vl); vl.getSource()?.clear(); });
      mvtLayersRef.current.forEach(vl => map.removeLayer(vl));
      vectorLayersRef.current.clear();
      wmsLayersRef.current.clear();
      wfsLayersRef.current.clear();
      mvtLayersRef.current.clear();
    };
  }, []);

  // Auto-fit when new layer becomes visible
  useEffect(() => {
    if (!mapInstance.current) return;

    const currentVisibleIds = new Set(layerList.filter(l => l.visible).map(l => l.id));
    const hasNew = [...currentVisibleIds].some(id => !prevVisibleIdsRef.current.has(id));
    prevVisibleIdsRef.current = currentVisibleIds;

    if (!hasNew) return;
    const withBounds = layerList.filter(l => l.visible && l.bounds && l.bounds.length === 4);
    if (withBounds.length === 0) return;

    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const layer of withBounds) {
      const [lngMin, latMin, lngMax, latMax] = layer.bounds!;
      if (lngMin < minLng) minLng = lngMin;
      if (latMin < minLat) minLat = latMin;
      if (lngMax > maxLng) maxLng = lngMax;
      if (latMax > maxLat) maxLat = latMax;
    }

    const ext = transformExtent([minLng, minLat, maxLng, maxLat], "EPSG:4326", "EPSG:3857");
    mapInstance.current.getView().fit(ext, { padding: [50, 50, 50, 50], duration: 500, maxZoom: 16 });
  }, [layerList]);
}
