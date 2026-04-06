import { Search, X } from "lucide-react";

interface LayerSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function LayerSearch({ value, onChange }: LayerSearchProps) {
  return (
    <div className="relative px-2 py-1.5">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        placeholder="레이어 검색..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-7 pl-7 pr-7 text-[13px] bg-accent/50 border border-border rounded-md outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
        data-testid="input-layer-search"
      />
      {value && (
        <button
          type="button"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
