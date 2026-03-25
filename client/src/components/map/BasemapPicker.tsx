import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { Layers } from "lucide-react";
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
    <div className="absolute bottom-3 left-3 z-10">
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white/70 hover:text-white border border-white/10 text-[10px] px-2.5 py-1 rounded-md font-normal transition-colors"
          data-testid="button-basemap-picker"
        >
          <Layers className="w-3 h-3" />
          {activeBasemap?.name || "배경지도"}
        </button>

        {open && enabledBasemaps.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 bg-black/80 backdrop-blur-md rounded-md border border-white/10 py-1 min-w-[160px]">
            {enabledBasemaps.map((bm) => (
              <button
                key={bm.id}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  bm.id === activeBasemap?.id
                    ? "text-cyan-400 bg-white/10"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
                onClick={() => { setDefaultMutation.mutate(bm.id); setOpen(false); }}
                data-testid={`button-select-basemap-${bm.id}`}
              >
                {bm.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Export activeBasemap for parent to use in basemap sync logic
export function useActiveBasemap() {
  const { data: basemapList = [] } = useQuery<Basemap[]>({ queryKey: ["/api/basemaps"] });
  const enabledBasemaps = basemapList.filter(b => b.enabled);
  return enabledBasemaps.find(b => b.isDefault) || enabledBasemaps[0];
}
