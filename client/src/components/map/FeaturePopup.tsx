import { forwardRef } from "react";

interface FeaturePopupProps {
  content: { name: string; props: Record<string, any> } | null;
  onClose: () => void;
}

export const FeaturePopup = forwardRef<HTMLDivElement, FeaturePopupProps>(
  ({ content, onClose }, ref) => (
    <div ref={ref} className="absolute" style={{ display: content ? "block" : "none" }}>
      {content && (
        <div className="bg-card border border-card-border rounded-md shadow-lg p-3 max-w-[280px] min-w-[180px]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h4 className="text-sm font-semibold truncate">{content.name}</h4>
            <button onClick={onClose} className="text-muted-foreground text-xs" data-testid="button-close-popup">
              x
            </button>
          </div>
          <div className="space-y-1">
            {Object.entries(content.props)
              .filter(([k]) => !k.startsWith("_"))
              .slice(0, 8)
              .map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-[11px]">
                  <span className="text-muted-foreground min-w-[60px] flex-shrink-0">{key}</span>
                  <span className="font-medium break-all">{String(value)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
);

FeaturePopup.displayName = "FeaturePopup";
