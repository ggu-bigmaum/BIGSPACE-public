import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Layer } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Target, MapPin, Loader2, X } from "lucide-react";

interface RadiusSearchPanelProps {
  center: { lng: number; lat: number } | null;
  onCenterChange: (center: { lng: number; lat: number } | null) => void;
  radius: number;
  onRadiusChange: (r: number) => void;
  onSearch: () => void;
  onClear: () => void;
  results: any | null;
  isSearching: boolean;
}

export function RadiusSearchPanel({
  center,
  onCenterChange,
  radius,
  onRadiusChange,
  onSearch,
  onClear,
  results,
  isSearching,
}: RadiusSearchPanelProps) {
  return (
    <div className="absolute top-3 left-3 z-20 w-72">
      <Card className="p-3 space-y-3 bg-card/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Radius Search</h3>
          </div>
          <Button size="icon" variant="ghost" onClick={onClear} data-testid="button-clear-search">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="text-[11px] text-muted-foreground">
          Click on the map to set center point
        </div>

        {center && (
          <div className="flex items-center gap-2 text-xs">
            <MapPin className="w-3 h-3 text-destructive" />
            <span className="font-mono">{center.lat.toFixed(6)}, {center.lng.toFixed(6)}</span>
          </div>
        )}

        <div>
          <Label className="text-xs">Radius (km)</Label>
          <Input
            type="number"
            value={radius}
            onChange={(e) => onRadiusChange(parseFloat(e.target.value) || 1)}
            min={0.1}
            max={100}
            step={0.5}
            data-testid="input-radius"
          />
        </div>

        <Button
          className="w-full"
          size="sm"
          disabled={!center || isSearching}
          onClick={onSearch}
          data-testid="button-search-radius"
        >
          {isSearching && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
          Search
        </Button>

        {results && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Results</span>
              <Badge variant="secondary" className="text-[10px]">{results.count} features</Badge>
            </div>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {results.features?.slice(0, 20).map((f: any, i: number) => (
                  <div key={i} className="text-[11px] px-2 py-1 rounded bg-muted/50 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span className="truncate">{f.properties?.name || `Feature ${i + 1}`}</span>
                  </div>
                ))}
                {results.count > 20 && (
                  <div className="text-[10px] text-muted-foreground text-center py-1">
                    +{results.count - 20} more
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </Card>
    </div>
  );
}
