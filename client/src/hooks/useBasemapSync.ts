import { useEffect, useRef, useState } from "react";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import { toLonLat } from "ol/proj";
import type OlMap from "ol/Map";
import type TileLayer from "ol/layer/Tile";
import type { Basemap } from "@shared/schema";
import { createTileSource, loadKakaoSdk, loadNaverSdk, kakaoZoomFromOl, naverZoomFromOl } from "@/lib/basemapUtils";

export function useBasemapSync(
  mapInstance: React.RefObject<OlMap | null>,
  baseTileLayerRef: React.RefObject<TileLayer | null>,
  activeBasemap: Basemap | undefined
) {
  const kakaoMapDivRef = useRef<HTMLDivElement>(null);
  const naverMapDivRef = useRef<HTMLDivElement>(null);
  const kakaoMapObjRef = useRef<any>(null);
  const naverMapObjRef = useRef<any>(null);
  const syncCleanupRef = useRef<(() => void) | null>(null);
  const tileErrorCountRef = useRef(0);
  const [basemapError, setBasemapError] = useState<string | null>(null);

  useEffect(() => {
    if (!baseTileLayerRef.current || !activeBasemap) return;

    const isKakao = activeBasemap.provider === "kakao";
    const isNaver = activeBasemap.provider === "naver";
    const isSdkBasemap = isKakao || isNaver;
    let cancelled = false;

    if (syncCleanupRef.current) { syncCleanupRef.current(); syncCleanupRef.current = null; }
    if (kakaoMapDivRef.current) kakaoMapDivRef.current.style.display = "none";
    if (naverMapDivRef.current) naverMapDivRef.current.style.display = "none";

    if (isSdkBasemap) {
      baseTileLayerRef.current.setVisible(false);
      const sdkLoader = isKakao ? loadKakaoSdk() : loadNaverSdk();

      sdkLoader.then((ok) => {
        if (cancelled) return;
        if (!ok) {
          setBasemapError(isKakao ? "카카오 지도 SDK 로드 실패." : "네이버 지도 SDK 로드 실패.");
          baseTileLayerRef.current?.setVisible(true);
          baseTileLayerRef.current?.setSource(new OSM());
          return;
        }
        setBasemapError(null);
        if (!mapInstance.current) return;

        const olViewport = mapInstance.current.getViewport();
        if (olViewport) olViewport.style.background = "transparent";

        const view = mapInstance.current.getView();
        const center = view.getCenter();
        const olZoom = view.getZoom() ?? 11;
        const [lon, lat] = center ? toLonLat(center) : [127.0, 37.5];

        if (isKakao) {
          const kakao = (window as any).kakao;
          const container = kakaoMapDivRef.current;
          if (!container) return;
          container.style.display = "block";

          let kmap: any;
          if (kakaoMapObjRef.current) {
            kmap = kakaoMapObjRef.current;
            kmap.setCenter(new kakao.maps.LatLng(lat, lon));
            kmap.setLevel(kakaoZoomFromOl(olZoom));
          } else {
            kmap = new kakao.maps.Map(container, {
              center: new kakao.maps.LatLng(lat, lon),
              level: kakaoZoomFromOl(olZoom),
              draggable: false, scrollwheel: false,
              disableDoubleClick: true, disableDoubleClickZoom: true,
            });
            kmap.setZoomable(false);
            kakaoMapObjRef.current = kmap;
          }

          let rafId = 0;
          let lastLevel = kmap.getLevel();
          const syncKakao = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
              rafId = 0;
              const v = mapInstance.current?.getView();
              if (!v) return;
              const c = v.getCenter();
              const z = v.getZoom() ?? 11;
              if (c) { const [lo, la] = toLonLat(c); kmap.setCenter(new kakao.maps.LatLng(la, lo)); }
              const newLevel = kakaoZoomFromOl(z);
              if (newLevel !== lastLevel) { kmap.setLevel(newLevel); lastLevel = newLevel; }
            });
          };
          view.on("change:center", syncKakao);
          view.on("change:resolution", syncKakao);
          syncCleanupRef.current = () => {
            if (rafId) cancelAnimationFrame(rafId);
            view.un("change:center", syncKakao);
            view.un("change:resolution", syncKakao);
          };
          mapInstance.current?.render();
        } else {
          const naver = (window as any).naver;
          const container = naverMapDivRef.current;
          if (!container) return;
          container.style.display = "block";

          let nmap: any;
          if (naverMapObjRef.current) {
            nmap = naverMapObjRef.current;
            nmap.setCenter(new naver.maps.LatLng(lat, lon));
            nmap.setZoom(naverZoomFromOl(olZoom));
          } else {
            nmap = new naver.maps.Map(container, {
              center: new naver.maps.LatLng(lat, lon),
              zoom: naverZoomFromOl(olZoom),
              draggable: false, scrollWheel: false, pinchZoom: false,
              disableDoubleClickZoom: true, disableDoubleTapZoom: true,
              disableTwoFingerTapZoom: true, keyboardShortcuts: false,
              logoControl: true, scaleControl: false, mapDataControl: false, zoomControl: false,
            });
            naverMapObjRef.current = nmap;
          }

          let rafId = 0;
          let lastZoom = nmap.getZoom();
          const syncNaver = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
              rafId = 0;
              const v = mapInstance.current?.getView();
              if (!v) return;
              const c = v.getCenter();
              const z = v.getZoom() ?? 11;
              if (c) { const [lo, la] = toLonLat(c); nmap.setCenter(new naver.maps.LatLng(la, lo)); }
              const newZoom = naverZoomFromOl(z);
              if (newZoom !== lastZoom) { nmap.setZoom(newZoom); lastZoom = newZoom; }
            });
          };
          view.on("change:center", syncNaver);
          view.on("change:resolution", syncNaver);
          syncCleanupRef.current = () => {
            if (rafId) cancelAnimationFrame(rafId);
            view.un("change:center", syncNaver);
            view.un("change:resolution", syncNaver);
          };
          mapInstance.current?.render();
        }
      });
    } else {
      const olViewport = mapInstance.current?.getViewport();
      if (olViewport) olViewport.style.background = "";
      baseTileLayerRef.current.setVisible(true);

      const { source, error } = createTileSource(activeBasemap);
      setBasemapError(error);
      tileErrorCountRef.current = 0;

      if (source instanceof XYZ && !(source instanceof OSM)) {
        const onTileError = () => {
          tileErrorCountRef.current++;
          if (tileErrorCountRef.current === 3)
            setBasemapError(`${activeBasemap.name}: 타일 로드 실패. URL 또는 API 키를 확인하세요.`);
        };
        const onTileLoad = () => {
          if (tileErrorCountRef.current >= 3) { tileErrorCountRef.current = 0; setBasemapError(null); }
        };
        source.on("tileloaderror", onTileError);
        source.on("tileloadend", onTileLoad);
        baseTileLayerRef.current.setSource(source);
        return () => { source.un("tileloaderror", onTileError); source.un("tileloadend", onTileLoad); };
      }

      baseTileLayerRef.current.setSource(source);
    }

    return () => {
      cancelled = true;
      if (syncCleanupRef.current) { syncCleanupRef.current(); syncCleanupRef.current = null; }
    };
  }, [activeBasemap]);

  return { kakaoMapDivRef, naverMapDivRef, basemapError };
}
