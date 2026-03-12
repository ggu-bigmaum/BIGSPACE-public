import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Layer } from "@shared/schema";
import { MapViewer } from "@/components/map-viewer";
import { RadiusSearchPanel } from "@/components/radius-search-panel";
import { FeatureInfoPanel } from "@/components/feature-info-panel";
import { SpatialAnalysisPanel } from "@/components/spatial-analysis-panel";
import { BoxSelectPanel } from "@/components/box-select-panel";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface MapPageProps {
  selectedLayerId?: string | null;
  analysisOpen?: boolean;
  onAnalysisClose?: () => void;
}

export default function MapPage({
  selectedLayerId = null,
  analysisOpen = false,
  onAnalysisClose,
}: MapPageProps) {
  const activeTool = "select";
  const { toast } = useToast();
  const [currentBbox, setCurrentBbox] = useState<number[]>([]);
  const [currentZoom, setCurrentZoom] = useState(11);
  const [selectionBbox, setSelectionBbox] = useState<[number, number, number, number] | null>(null);

  const [radiusCenter, setRadiusCenter] = useState<{ lng: number; lat: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(2);
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  const { data: layers = [] } = useQuery<Layer[]>({
    queryKey: ["/api/layers"],
  });

  const selectedLayer = layers.find(l => l.id === selectedLayerId) || null;

  const handleMapClick = useCallback((lng: number, lat: number) => {
    if (activeTool === "radius") {
      setRadiusCenter({ lng, lat });
    }
  }, [activeTool]);

  const handleBoxSelect = useCallback((bbox: [number, number, number, number]) => {
    if (bbox) {
      setSelectionBbox(bbox);
    } else {
      setSelectionBbox(null);
    }
  }, []);

  const handleRadiusSearch = async () => {
    if (!radiusCenter) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/spatial/radius?lng=${radiusCenter.lng}&lat=${radiusCenter.lat}&radius=${radiusKm}`
      );
      const data = await res.json();
      setSearchResults(data);
      toast({
        title: "Search complete",
        description: `Found ${data.count} features within ${radiusKm}km`,
      });
    } catch (e) {
      toast({ title: "Search failed", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setRadiusCenter(null);
    setSearchResults(null);
  };

  return (
    <div className="relative w-full h-full">
      {/* 모바일 사이드바 열기 버튼 */}
      <div className="absolute top-3 left-3 z-20 md:hidden">
        <SidebarTrigger className="bg-background/90 backdrop-blur-sm border border-border shadow-md rounded-md h-9 w-9" />
      </div>

      <MapViewer
        layers={layers}
        selectedLayerId={selectedLayerId}
        activeTool={activeTool || "select"}
        onMapClick={handleMapClick}
        onBoxSelect={handleBoxSelect}
        onBboxChange={setCurrentBbox}
        onZoomChange={setCurrentZoom}
        radiusCenter={radiusCenter}
        radiusKm={radiusKm}
        searchResults={searchResults}
      />

      {activeTool === "radius" && (
        <RadiusSearchPanel
          center={radiusCenter}
          onCenterChange={setRadiusCenter}
          radius={radiusKm}
          onRadiusChange={setRadiusKm}
          onSearch={handleRadiusSearch}
          onClear={handleClearSearch}
          results={searchResults}
          isSearching={isSearching}
        />
      )}

      {selectionBbox && selectedLayer && (
        <BoxSelectPanel
          layer={selectedLayer}
          bbox={selectionBbox}
          onClose={() => setSelectionBbox(null)}
        />
      )}

      {selectedLayer && !selectionBbox && (
        <FeatureInfoPanel
          layer={selectedLayer}
          bbox={currentBbox}
          zoom={currentZoom}
        />
      )}

      {analysisOpen && (
        <SpatialAnalysisPanel
          layers={layers}
          onClose={() => onAnalysisClose?.()}
        />
      )}
    </div>
  );
}
