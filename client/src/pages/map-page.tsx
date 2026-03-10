import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Layer } from "@shared/schema";
import { MapViewer } from "@/components/map-viewer";
import { RadiusSearchPanel } from "@/components/radius-search-panel";
import { FeatureInfoPanel } from "@/components/feature-info-panel";
import { SpatialAnalysisPanel } from "@/components/spatial-analysis-panel";
import { useToast } from "@/hooks/use-toast";

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
      <MapViewer
        layers={layers}
        selectedLayerId={selectedLayerId}
        activeTool={activeTool || "select"}
        onMapClick={handleMapClick}
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

      {selectedLayer && (
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
