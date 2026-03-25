import { useState, useCallback } from "react";
import { Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface MapSearchBoxProps {
  onMoveToLocation: (lat: number, lng: number, zoom?: number, label?: string) => void;
}

export function MapSearchBox({ onMoveToLocation }: MapSearchBoxProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [geocodeResults, setGeocodeResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const searchByGeocode = useCallback(async (query: string) => {
    setSearchLoading(true);
    setShowResults(true);
    try {
      const params = new URLSearchParams({
        q: query, format: "json", limit: "5",
        addressdetails: "1", "accept-language": "ko", countrycodes: "kr",
      });
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "User-Agent": "GIS-Solution/1.0" },
      });
      if (!resp.ok) throw new Error("Geocoding failed");
      const data = await resp.json();
      setGeocodeResults(data);
      if (data.length === 1) {
        const name = data[0].display_name.split(",")[0];
        onMoveToLocation(parseFloat(data[0].lat), parseFloat(data[0].lon), 15, name);
        setShowResults(false);
        setSearchQuery(name);
      }
    } catch {
      setGeocodeResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [onMoveToLocation]);

  const handleSearchGo = useCallback(() => {
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim();
    const coordMatch = q.match(/^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const a = parseFloat(coordMatch[1]);
      const b = parseFloat(coordMatch[2]);
      let lng: number, lat: number;
      if (Math.abs(a) <= 90 && Math.abs(b) > 90) { lat = a; lng = b; }
      else if (Math.abs(b) <= 90 && Math.abs(a) > 90) { lng = a; lat = b; }
      else { lat = a; lng = b; }
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        onMoveToLocation(lat, lng, 15, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setSearchQuery("");
        setShowResults(false);
        return;
      }
    }
    searchByGeocode(q);
  }, [searchQuery, onMoveToLocation, searchByGeocode]);

  const handleSelectResult = useCallback((result: { display_name: string; lat: string; lon: string }) => {
    const name = result.display_name.split(",")[0];
    onMoveToLocation(parseFloat(result.lat), parseFloat(result.lon), 15, name);
    setSearchQuery(name);
    setShowResults(false);
    setGeocodeResults([]);
  }, [onMoveToLocation]);

  return (
    <div className="absolute top-3 z-10 left-3 w-[calc(100%-100px)] md:left-1/2 md:w-full md:max-w-md md:px-4 md:-translate-x-1/2">
      <form
        onSubmit={(e) => { e.preventDefault(); handleSearchGo(); }}
        className="flex items-center gap-1 h-8 bg-black/60 backdrop-blur-md rounded-md border border-white/10 px-2"
      >
        <Search className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
        <Input
          type="text"
          placeholder="주소, 지명 또는 좌표 검색..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!e.target.value.trim()) { setShowResults(false); setGeocodeResults([]); }
          }}
          onFocus={() => { if (geocodeResults.length > 0) setShowResults(true); }}
          className="border-0 bg-transparent text-white placeholder:text-white/40 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 h-full py-0"
          data-testid="input-map-search"
        />
        {searchLoading ? (
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
          </div>
        ) : (
          <Button
            size="icon" variant="ghost" type="submit"
            className="text-white/60 hover:text-white flex-shrink-0 w-7 h-7"
            data-testid="button-map-pin"
          >
            <MapPin className="w-3.5 h-3.5" />
          </Button>
        )}
      </form>

      {showResults && geocodeResults.length > 0 && (
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

      {showResults && !searchLoading && geocodeResults.length === 0 && searchQuery.trim() && (
        <div className="mt-1 bg-black/80 backdrop-blur-md rounded-md border border-white/10 px-3 py-3" data-testid="search-no-results">
          <p className="text-xs text-white/50 text-center">검색 결과가 없습니다</p>
        </div>
      )}
    </div>
  );
}
