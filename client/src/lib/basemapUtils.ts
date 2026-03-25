import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import type { Basemap } from "@shared/schema";

export function createTileSource(basemap: Basemap): { source: OSM | XYZ; error: string | null } {
  if (basemap.provider === "osm") {
    return { source: new OSM(), error: null };
  }

  if (basemap.provider === "esri") {
    return {
      source: new XYZ({ url: basemap.urlTemplate, maxZoom: basemap.maxZoom, attributions: basemap.attribution || undefined }),
      error: null,
    };
  }

  // SDK-based providers (naver/kakao) use a dummy OSM source; real rendering is via SDK overlay
  if (basemap.provider === "naver" || basemap.provider === "kakao") {
    return { source: new OSM(), error: null };
  }

  let url = basemap.urlTemplate;
  if (!url) {
    return { source: new OSM(), error: `${basemap.name}: 타일 URL이 설정되지 않았습니다.` };
  }

  if (url.includes("{apiKey}")) {
    if (!basemap.apiKey) {
      return { source: new OSM(), error: `${basemap.name}: API 키가 입력되지 않았습니다.` };
    }
    url = url.replace("{apiKey}", basemap.apiKey);
  }

  return {
    source: new XYZ({ url, maxZoom: basemap.maxZoom, attributions: basemap.attribution || undefined }),
    error: null,
  };
}

export function kakaoZoomFromOl(olZoom: number): number {
  return Math.max(1, Math.min(14, Math.round(21 - olZoom)));
}

export function naverZoomFromOl(olZoom: number): number {
  return Math.max(6, Math.min(21, Math.round(olZoom)));
}

// Module-level singletons so SDK scripts are only loaded once per session
let naverSdkLoadPromise: Promise<boolean> | null = null;

export function loadNaverSdk(): Promise<boolean> {
  if (naverSdkLoadPromise) return naverSdkLoadPromise;
  naverSdkLoadPromise = new Promise((resolve) => {
    const naver = (window as any).naver;
    if (naver?.maps?.Map) { resolve(true); return; }

    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${import.meta.env.VITE_NCP_CLIENT_ID || ""}`;
    script.onload = () => {
      if ((window as any).naver?.maps?.Map) { resolve(true); }
      else { naverSdkLoadPromise = null; resolve(false); }
    };
    script.onerror = () => { naverSdkLoadPromise = null; resolve(false); };
    document.head.appendChild(script);
  });
  return naverSdkLoadPromise;
}

let kakaoSdkLoadPromise: Promise<boolean> | null = null;

export function loadKakaoSdk(): Promise<boolean> {
  if (kakaoSdkLoadPromise) return kakaoSdkLoadPromise;
  kakaoSdkLoadPromise = new Promise((resolve) => {
    const kakao = (window as any).kakao;
    if (kakao?.maps?.Map) { resolve(true); return; }

    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${import.meta.env.VITE_KAKAO_JS_KEY || ""}&autoload=false`;
    script.onload = () => {
      const k = (window as any).kakao;
      if (k?.maps?.load) {
        k.maps.load(() => {
          if (k.maps.Map) { resolve(true); }
          else { kakaoSdkLoadPromise = null; resolve(false); }
        });
      } else { kakaoSdkLoadPromise = null; resolve(false); }
    };
    script.onerror = () => { kakaoSdkLoadPromise = null; resolve(false); };
    document.head.appendChild(script);
  });
  return kakaoSdkLoadPromise;
}
