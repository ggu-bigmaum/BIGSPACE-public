import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layers, ChevronUp } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Basemap } from "@shared/schema";

export function BasemapPicker() {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const { data: basemapList = [] } = useQuery<Basemap[]>({ queryKey: ["/api/basemaps"] });
  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("POST", `/api/basemaps/${id}/default`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/basemaps"] }); },
  });

  const enabledBasemaps = basemapList.filter(b => b.enabled);
  const activeBasemap = enabledBasemaps.find(b => b.isDefault) || enabledBasemaps[0];

  return (
    <div className="relative" ref={pickerRef}>
      <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-2.5 py-1 bg-background/80 backdrop-blur-sm border border-border rounded-md shadow-md text-[10px] text-foreground hover:bg-accent transition-colors"
          data-testid="button-basemap-picker"
        >
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{activeBasemap?.name || "배경지도"}</span>
          <ChevronUp className={`w-3 h-3 text-muted-foreground transition-transform ${open ? "" : "rotate-180"}`} />
        </button>

        {open && enabledBasemaps.length > 0 && (
          <div className="absolute bottom-full mb-2 right-0 bg-background border border-border rounded-lg shadow-lg p-2 flex gap-2">
            {enabledBasemaps.map((bm) => (
              <button
                key={bm.id}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-md transition-colors ${
                  bm.id === activeBasemap?.id
                    ? "ring-2 ring-primary bg-accent"
                    : "hover:bg-accent"
                }`}
                onClick={() => { setDefaultMutation.mutate(bm.id); setOpen(false); }}
                data-testid={`button-select-basemap-${bm.id}`}
              >
                <div className="w-16 h-16 rounded bg-muted overflow-hidden flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground font-medium">{bm.name.slice(0, 6)}</span>
                </div>
                <span className="text-[10px] text-muted-foreground leading-none">{bm.name}</span>
              </button>
            ))}
          </div>
        )}
    </div>
  );
}

export function useActiveBasemap() {
  const { data: basemapList = [] } = useQuery<Basemap[]>({ queryKey: ["/api/basemaps"] });
  const enabledBasemaps = basemapList.filter(b => b.enabled);
  return enabledBasemaps.find(b => b.isDefault) || enabledBasemaps[0];
}
