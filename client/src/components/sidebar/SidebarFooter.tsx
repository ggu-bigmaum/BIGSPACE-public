import { Sun, Moon, Monitor, Settings2, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";

interface SidebarFooterContentProps {
  onSettingsOpen?: () => void;
  closeMobileIfNeeded: () => void;
}

const THEME_CYCLE = ["light", "dark", "system"] as const;
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor } as const;
const THEME_LABEL = {
  light: "라이트 모드",
  dark: "다크 모드",
  system: "시스템 설정",
} as const;

export function SidebarFooterContent({
  onSettingsOpen,
  closeMobileIfNeeded,
}: SidebarFooterContentProps) {
  const { user, logoutMutation } = useAuth();
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    setTheme(next);
  };

  const ThemeIcon = THEME_ICON[theme];

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-1.5 flex-1 min-w-0 px-1">
        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] text-muted-foreground truncate">
          {user?.username}
          {user?.role === "admin" && (
            <span className="ml-1 text-teal-600 font-medium">(관리자)</span>
          )}
        </span>
      </div>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={cycleTheme}
              data-testid="button-theme-toggle"
            >
              <ThemeIcon className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {THEME_LABEL[theme]}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => {
                onSettingsOpen?.();
                closeMobileIfNeeded();
              }}
              data-testid="button-open-settings"
            >
              <Settings2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            시스템 설정
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            로그아웃
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
