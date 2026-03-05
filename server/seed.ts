import { storage } from "./storage";
import { db } from "./db";
import { layers } from "@shared/schema";

export async function seedDatabase() {
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
