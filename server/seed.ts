import { storage } from "./storage";
import { db } from "./db";
import { layers, basemaps } from "@shared/schema";
import { eq } from "drizzle-orm";

async function upsertBasemaps() {
  console.log("Upserting basemaps...");

  const kakaoKey = process.env.VITE_KAKAO_JS_KEY || "";
  const ncpClientId = process.env.VITE_NCP_CLIENT_ID || "";
  const vworldKey = process.env.VITE_VWORLD_KEY || "";

  const defaultBasemaps = [
    {
      name: "위성 영상",
      provider: "esri",
      urlTemplate: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      apiKey: null,
      enabled: true,
      isDefault: false,
      sortOrder: -1,
      attribution: "© Esri, Maxar, Earthstar Geographics",
      maxZoom: 19,
      subdomains: null,
      description: "ESRI 위성영상 지도. API 키 불필요.",
    },
    {
      name: "OpenStreetMap",
      provider: "osm",
      urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      apiKey: null,
      enabled: true,
      isDefault: false,
      sortOrder: 0,
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
      subdomains: null,
      description: "전 세계 오픈소스 지도. API 키 불필요.",
    },
    {
      name: "VWorld 기본지도",
      provider: "vworld",
      urlTemplate: "https://api.vworld.kr/req/wmts/1.0.0/{apiKey}/Base/{z}/{y}/{x}.png",
      apiKey: vworldKey || "",
      enabled: true,
      isDefault: true,
      sortOrder: 1,
      attribution: "© VWorld (국토정보플랫폼)",
      maxZoom: 18,
      subdomains: null,
      description: "국토교통부 제공 기본지도. api.vworld.kr에서 API 키 발급 필요.",
    },
    {
      name: "VWorld 위성지도",
      provider: "vworld",
      urlTemplate: "https://api.vworld.kr/req/wmts/1.0.0/{apiKey}/Satellite/{z}/{y}/{x}.jpeg",
      apiKey: vworldKey || "",
      enabled: true,
      isDefault: false,
      sortOrder: 2,
      attribution: "© VWorld (국토정보플랫폼)",
      maxZoom: 18,
      subdomains: null,
      description: "VWorld 위성영상 지도. 동일한 VWorld API 키 사용.",
    },
    {
      name: "네이버 지도",
      provider: "naver",
      urlTemplate: "/api/proxy/naver-tiles/{z}/{x}/{y}",
      apiKey: ncpClientId || "",
      enabled: true,
      isDefault: false,
      sortOrder: 3,
      attribution: "© Naver Corp.",
      maxZoom: 21,
      subdomains: null,
      description: "네이버 클라우드 플랫폼 지도. 서버 프록시를 통해 타일 제공.",
    },
    {
      name: "카카오 지도",
      provider: "kakao",
      urlTemplate: "",
      apiKey: kakaoKey || "",
      enabled: true,
      isDefault: false,
      sortOrder: 4,
      attribution: "© Kakao Corp.",
      maxZoom: 21,
      subdomains: null,
      description: "카카오 지도 SDK 연동. 도로, 위성, 하이브리드 맵 지원.",
    },
  ];

  for (const bm of defaultBasemaps) {
    const existing = await db.select().from(basemaps).where(eq(basemaps.name, bm.name));
    if (existing.length > 0) {
      await db.update(basemaps).set({
        provider: bm.provider,
        urlTemplate: bm.urlTemplate,
        apiKey: bm.apiKey,
        enabled: bm.enabled,
        isDefault: bm.isDefault,
        sortOrder: bm.sortOrder,
        attribution: bm.attribution,
        maxZoom: bm.maxZoom,
        description: bm.description,
      }).where(eq(basemaps.name, bm.name));
    } else {
      await storage.createBasemap(bm);
    }
  }

  console.log("Basemaps upserted: ESRI, OSM, VWorld, Naver, Kakao");
}

async function upsertSettings() {
  console.log("Upserting settings...");

  const defaultSettings = [
    {
      key: "rendering.defaultRenderMode",
      value: "auto",
      description: "기본 렌더링 모드. auto: 줌 레벨에 따라 자동 전환 | feature: 항상 개별 피처 표시 | tile: 타일 기반 표시 | aggregate: 집계 클러스터만 표시",
      category: "rendering",
    },
    {
      key: "rendering.defaultFeatureLimit",
      value: 2000,
      description: "한 번에 로드할 최대 피처 수. 값이 클수록 상세하지만 성능이 저하됩니다. 권장: 1000~5000",
      category: "rendering",
    },
    {
      key: "rendering.defaultMinZoomForFeatures",
      value: 15,
      description: "개별 피처를 표시하는 최소 줌 레벨. 이보다 낮은 줌에서는 집계/클러스터로 표시됩니다. 범위: 0~20",
      category: "rendering",
    },
    {
      key: "rendering.aggregateGridSize",
      value: 20,
      description: "저줌 집계(aggregate) 시 그리드 분할 수. 값이 클수록 촘촘한 집계. 권장: 10~40",
      category: "rendering",
    },
    {
      key: "rendering.debounceMs",
      value: 300,
      description: "지도 이동/줌 시 데이터 요청 디바운스 시간(ms). 값이 작으면 반응이 빠르지만 서버 부하가 증가합니다. 권장: 200~500",
      category: "rendering",
    },
    {
      key: "map.defaultCenter",
      value: [126.978, 37.5665],
      description: "지도 초기 중심 좌표 [경도, 위도]. 서울: [126.978, 37.5665]",
      category: "map",
    },
    {
      key: "map.defaultZoom",
      value: 11,
      description: "지도 초기 줌 레벨. 범위: 2~20. 도시 전체 보기: 11, 구/동 단위: 14~15",
      category: "map",
    },
    {
      key: "map.maxZoom",
      value: 20,
      description: "최대 줌 레벨. 범위: 15~22",
      category: "map",
    },
    {
      key: "map.minZoom",
      value: 2,
      description: "최소 줌 레벨. 범위: 0~10",
      category: "map",
    },
  ];

  for (const s of defaultSettings) {
    await storage.upsertSetting(s);
  }

  console.log("Settings upserted");
}

async function upsertEmergencyLayers() {
  const existingLayers = await storage.getLayers();
  const existingNames = new Set(existingLayers.map(l => l.name));

  const emergencyLayers = [
    {
      name: "응급출동 현황 2020",
      description: "소방청 구급출동 데이터 (2020년)",
      category: "응급출동",
      geometryType: "Point" as const,
      srid: 4326,
      renderMode: "auto" as const,
      featureLimit: 5000,
      minZoomForFeatures: 14,
      minZoomForClusters: 8,
      tileEnabled: true,
      tileMaxZoom: 14,
      visible: true,
      opacity: 0.7,
      strokeColor: "#65a30d",
      fillColor: "#65a30d40",
      strokeWidth: 1,
      pointRadius: 4,
    },
    {
      name: "응급출동 현황 2021",
      description: "소방청 구급출동 데이터 (2021년)",
      category: "응급출동",
      geometryType: "Point" as const,
      srid: 4326,
      renderMode: "auto" as const,
      featureLimit: 5000,
      minZoomForFeatures: 14,
      minZoomForClusters: 8,
      tileEnabled: true,
      tileMaxZoom: 14,
      visible: false,
      opacity: 1,
      strokeColor: "#0d9488",
      fillColor: "#0d948850",
      strokeWidth: 1,
      pointRadius: 4,
    },
    {
      name: "응급출동 현황 2022",
      description: "소방청 구급출동 데이터 (2022년)",
      category: "응급출동",
      geometryType: "Point" as const,
      srid: 4326,
      renderMode: "auto" as const,
      featureLimit: 5000,
      minZoomForFeatures: 14,
      minZoomForClusters: 8,
      tileEnabled: true,
      tileMaxZoom: 14,
      visible: false,
      opacity: 0.65,
      strokeColor: "#ef4444",
      fillColor: "#ef444480",
      strokeWidth: 1,
      pointRadius: 4,
    },
  ];

  for (const layer of emergencyLayers) {
    if (!existingNames.has(layer.name)) {
      await storage.createLayer(layer);
      console.log(`Created layer metadata: ${layer.name} (upload CSV to add features)`);
    }
  }
}

export async function seedDatabase() {
  await upsertBasemaps();
  await upsertSettings();
  await upsertEmergencyLayers();

  const existingLayers = await storage.getLayers();
  const hasSampleLayers = existingLayers.some(l =>
    l.name === "Public Facilities" || l.name === "Major Roads"
  );
  if (hasSampleLayers) {
    console.log(`Sample layers already exist. Skipping sample layer seed.`);
    return;
  }

  console.log("Seeding database with sample GIS data...");

  const facilityLayer = await storage.createLayer({
    name: "Public Facilities",
    description: "Public infrastructure and facilities across Seoul metropolitan area",
    category: "인프라",
    geometryType: "Point",
    srid: 4326,
    renderMode: "auto",
    featureLimit: 2000,
    minZoomForFeatures: 13,
    tileEnabled: true,
    tileMaxZoom: 14,
    visible: false,
    opacity: 1,
    strokeColor: "#2563eb",
    fillColor: "#3b82f680",
    strokeWidth: 2,
    pointRadius: 6,
  });

  const roadLayer = await storage.createLayer({
    name: "Major Roads",
    description: "Major road network and highways",
    category: "교통",
    geometryType: "LineString",
    srid: 4326,
    renderMode: "auto",
    featureLimit: 1000,
    minZoomForFeatures: 12,
    tileEnabled: true,
    tileMaxZoom: 14,
    visible: false,
    opacity: 0.8,
    strokeColor: "#dc2626",
    fillColor: "#ef444480",
    strokeWidth: 3,
    pointRadius: 4,
  });

  const zoneLayer = await storage.createLayer({
    name: "Administrative Zones",
    description: "Administrative district boundaries",
    category: "행정",
    geometryType: "Polygon",
    srid: 4326,
    renderMode: "auto",
    featureLimit: 500,
    minZoomForFeatures: 10,
    tileEnabled: true,
    tileMaxZoom: 14,
    visible: true,
    opacity: 0.5,
    strokeColor: "#ca8a04",
    fillColor: "#ca8a0440",
    strokeWidth: 2,
    pointRadius: 4,
  });

  const facilityTypes = ["병원", "학교", "도서관", "소방서", "경찰서", "공원", "주민센터", "우체국"];
  const seoulCenter = { lng: 126.978, lat: 37.5665 };
  const facilityFeatures = [];

  for (let i = 0; i < 200; i++) {
    const lng = seoulCenter.lng + (Math.random() - 0.5) * 0.3;
    const lat = seoulCenter.lat + (Math.random() - 0.5) * 0.2;
    const ftype = facilityTypes[Math.floor(Math.random() * facilityTypes.length)];
    facilityFeatures.push({
      layerId: facilityLayer.id,
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        name: `${ftype} ${i + 1}`,
        type: ftype,
        status: Math.random() > 0.2 ? "운영중" : "점검중",
        capacity: Math.floor(Math.random() * 500) + 50,
        address: `서울특별시 ${Math.floor(Math.random() * 25) + 1}구`,
      },
    });
  }
  await storage.createFeatures(facilityFeatures);

  const roadFeatures = [];
  const roadNames = ["강남대로", "테헤란로", "세종대로", "동호로", "올림픽대로", "한강대로"];
  for (let i = 0; i < 30; i++) {
    const startLng = seoulCenter.lng + (Math.random() - 0.5) * 0.25;
    const startLat = seoulCenter.lat + (Math.random() - 0.5) * 0.15;
    const points = [];
    let curLng = startLng;
    let curLat = startLat;
    const numPoints = Math.floor(Math.random() * 8) + 3;
    for (let j = 0; j < numPoints; j++) {
      points.push([curLng, curLat]);
      curLng += (Math.random() - 0.5) * 0.02;
      curLat += (Math.random() - 0.5) * 0.01;
    }
    roadFeatures.push({
      layerId: roadLayer.id,
      geometry: { type: "LineString", coordinates: points },
      properties: {
        name: `${roadNames[i % roadNames.length]} ${Math.floor(i / roadNames.length) + 1}구간`,
        lanes: Math.floor(Math.random() * 4) + 2,
        speedLimit: [40, 50, 60, 80][Math.floor(Math.random() * 4)],
        surface: Math.random() > 0.3 ? "아스팔트" : "콘크리트",
      },
    });
  }
  await storage.createFeatures(roadFeatures);

  const districtNames = ["강남구", "종로구", "마포구", "용산구", "송파구"];
  const zoneFeatures = [];
  for (let i = 0; i < districtNames.length; i++) {
    const cx = seoulCenter.lng + (i - 2) * 0.05;
    const cy = seoulCenter.lat + ((i % 2) - 0.5) * 0.04;
    const size = 0.02 + Math.random() * 0.01;
    zoneFeatures.push({
      layerId: zoneLayer.id,
      geometry: {
        type: "Polygon",
        coordinates: [[
          [cx - size, cy - size],
          [cx + size, cy - size],
          [cx + size * 0.8, cy],
          [cx + size, cy + size],
          [cx - size, cy + size],
          [cx - size * 0.8, cy],
          [cx - size, cy - size],
        ]],
      },
      properties: {
        name: districtNames[i],
        population: Math.floor(Math.random() * 500000) + 200000,
        area_km2: Math.floor(Math.random() * 30) + 10,
        established: `19${Math.floor(Math.random() * 50) + 50}`,
      },
    });
  }
  await storage.createFeatures(zoneFeatures);

  console.log("Seed complete: 200 facilities, 30 roads, 5 zones");
}
