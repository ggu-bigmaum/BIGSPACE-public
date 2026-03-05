import { storage } from "./storage";
import { db } from "./db";
import { layers, basemaps } from "@shared/schema";

async function seedBasemaps() {
  const existing = await storage.getBasemaps();
  if (existing.length > 0) return;

  console.log("Seeding default basemaps...");

  await storage.createBasemap({
    name: "OpenStreetMap",
    provider: "osm",
    urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    enabled: true,
    isDefault: true,
    sortOrder: 0,
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
    description: "전 세계 오픈소스 지도. API 키 불필요.",
  });

  await storage.createBasemap({
    name: "VWorld 기본지도",
    provider: "vworld",
    urlTemplate: "https://api.vworld.kr/req/wmts/1.0.0/{apiKey}/Base/{z}/{y}/{x}.png",
    apiKey: "",
    enabled: false,
    isDefault: false,
    sortOrder: 1,
    attribution: "© VWorld (국토정보플랫폼)",
    maxZoom: 18,
    description: "국토교통부 제공 기본지도. api.vworld.kr에서 API 키 발급 필요.",
  });

  await storage.createBasemap({
    name: "VWorld 위성지도",
    provider: "vworld",
    urlTemplate: "https://api.vworld.kr/req/wmts/1.0.0/{apiKey}/Satellite/{z}/{y}/{x}.jpeg",
    apiKey: "",
    enabled: false,
    isDefault: false,
    sortOrder: 2,
    attribution: "© VWorld (국토정보플랫폼)",
    maxZoom: 18,
    description: "VWorld 위성영상 지도. 동일한 VWorld API 키 사용.",
  });

  await storage.createBasemap({
    name: "Naver Map",
    provider: "naver",
    urlTemplate: "",
    apiKey: "",
    enabled: false,
    isDefault: false,
    sortOrder: 3,
    attribution: "© Naver Corp.",
    maxZoom: 21,
    description: "네이버 지도. developers.naver.com에서 Client ID 발급 필요. 네이버 지도 SDK는 별도 연동이 필요합니다.",
  });

  await storage.createBasemap({
    name: "Kakao Map",
    provider: "kakao",
    urlTemplate: "",
    apiKey: "",
    enabled: false,
    isDefault: false,
    sortOrder: 4,
    attribution: "© Kakao Corp.",
    maxZoom: 21,
    description: "카카오 지도. developers.kakao.com에서 JavaScript 키 발급 필요. 카카오 지도 SDK는 별도 연동이 필요합니다.",
  });

  console.log("Basemaps seeded: OSM (default), VWorld, Naver, Kakao");
}

async function seedSettings() {
  const existing = await storage.getSettings();
  if (existing.length > 0) return;

  console.log("Seeding default settings...");

  await storage.upsertSetting({
    key: "rendering.defaultRenderMode",
    value: "auto",
    description: "기본 렌더링 모드. auto: 줌 레벨에 따라 자동 전환 | feature: 항상 개별 피처 표시 | tile: 타일 기반 표시 | aggregate: 집계 클러스터만 표시",
    category: "rendering",
  });

  await storage.upsertSetting({
    key: "rendering.defaultFeatureLimit",
    value: 2000,
    description: "한 번에 로드할 최대 피처 수. 값이 클수록 상세하지만 성능이 저하됩니다. 권장: 1000~5000",
    category: "rendering",
  });

  await storage.upsertSetting({
    key: "rendering.defaultMinZoomForFeatures",
    value: 15,
    description: "개별 피처를 표시하는 최소 줌 레벨. 이보다 낮은 줌에서는 집계/클러스터로 표시됩니다. 범위: 0~20",
    category: "rendering",
  });

  await storage.upsertSetting({
    key: "rendering.aggregateGridSize",
    value: 20,
    description: "저줌 집계(aggregate) 시 그리드 분할 수. 값이 클수록 촘촘한 집계. 권장: 10~40",
    category: "rendering",
  });

  await storage.upsertSetting({
    key: "rendering.debounceMs",
    value: 300,
    description: "지도 이동/줌 시 데이터 요청 디바운스 시간(ms). 값이 작으면 반응이 빠르지만 서버 부하가 증가합니다. 권장: 200~500",
    category: "rendering",
  });

  await storage.upsertSetting({
    key: "map.defaultCenter",
    value: [126.978, 37.5665],
    description: "지도 초기 중심 좌표 [경도, 위도]. 서울: [126.978, 37.5665]",
    category: "map",
  });

  await storage.upsertSetting({
    key: "map.defaultZoom",
    value: 11,
    description: "지도 초기 줌 레벨. 범위: 2~20. 도시 전체 보기: 11, 구/동 단위: 14~15",
    category: "map",
  });

  await storage.upsertSetting({
    key: "map.maxZoom",
    value: 20,
    description: "최대 줌 레벨. 범위: 15~22",
    category: "map",
  });

  await storage.upsertSetting({
    key: "map.minZoom",
    value: 2,
    description: "최소 줌 레벨. 범위: 0~10",
    category: "map",
  });

  console.log("Default settings seeded");
}

export async function seedDatabase() {
  await seedBasemaps();
  await seedSettings();

  const existingLayers = await storage.getLayers();
  if (existingLayers.length > 0) return;

  console.log("Seeding database with sample GIS data...");

  const facilityLayer = await storage.createLayer({
    name: "Public Facilities",
    description: "Public infrastructure and facilities across Seoul metropolitan area",
    geometryType: "Point",
    srid: 4326,
    renderMode: "auto",
    featureLimit: 2000,
    minZoomForFeatures: 13,
    tileEnabled: true,
    tileMaxZoom: 14,
    visible: true,
    opacity: 1,
    strokeColor: "#2563eb",
    fillColor: "#3b82f680",
    strokeWidth: 2,
    pointRadius: 6,
  });

  const roadLayer = await storage.createLayer({
    name: "Major Roads",
    description: "Major road network and highways",
    geometryType: "LineString",
    srid: 4326,
    renderMode: "auto",
    featureLimit: 1000,
    minZoomForFeatures: 12,
    tileEnabled: true,
    tileMaxZoom: 14,
    visible: true,
    opacity: 0.8,
    strokeColor: "#dc2626",
    fillColor: "#ef444480",
    strokeWidth: 3,
    pointRadius: 4,
  });

  const zoneLayer = await storage.createLayer({
    name: "Administrative Zones",
    description: "Administrative district boundaries",
    geometryType: "Polygon",
    srid: 4326,
    renderMode: "auto",
    featureLimit: 500,
    minZoomForFeatures: 10,
    tileEnabled: true,
    tileMaxZoom: 14,
    visible: true,
    opacity: 0.5,
    strokeColor: "#16a34a",
    fillColor: "#22c55e30",
    strokeWidth: 2,
    pointRadius: 4,
  });

  const facilityTypes = ["Hospital", "School", "Library", "Fire Station", "Police Station", "Park", "Community Center", "Post Office"];
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
        status: Math.random() > 0.2 ? "Active" : "Under Maintenance",
        capacity: Math.floor(Math.random() * 500) + 50,
        address: `Seoul District ${Math.floor(Math.random() * 25) + 1}`,
      },
    });
  }
  await storage.createFeatures(facilityFeatures);

  const roadFeatures = [];
  const roadNames = ["Gangnam-daero", "Teheran-ro", "Sejong-daero", "Dongho-ro", "Olympic-daero", "Hangang-daero"];
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
        name: `${roadNames[i % roadNames.length]} Section ${Math.floor(i / roadNames.length) + 1}`,
        lanes: Math.floor(Math.random() * 4) + 2,
        speedLimit: [40, 50, 60, 80][Math.floor(Math.random() * 4)],
        surface: Math.random() > 0.3 ? "Asphalt" : "Concrete",
      },
    });
  }
  await storage.createFeatures(roadFeatures);

  const districtNames = ["Gangnam", "Jongno", "Mapo", "Yongsan", "Songpa"];
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
        name: `${districtNames[i]}-gu`,
        population: Math.floor(Math.random() * 500000) + 200000,
        area_km2: Math.floor(Math.random() * 30) + 10,
        established: `19${Math.floor(Math.random() * 50) + 50}`,
      },
    });
  }
  await storage.createFeatures(zoneFeatures);

  console.log("Seed complete: 200 facilities, 30 roads, 5 zones");
}
