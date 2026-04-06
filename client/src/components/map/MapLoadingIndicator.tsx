import { Loader2 } from "lucide-react";

interface MapLoadingIndicatorProps {
  loading: boolean;
  message?: string;
}

export function MapLoadingIndicator({ loading, message = "불러오는 중..." }: MapLoadingIndicatorProps) {
  if (!loading) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-background/90 backdrop-blur-sm border border-border rounded-md shadow-md text-[12px] text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        {message}
      </div>
    </div>
  );
}
