import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { AddLayerDialog } from "@/components/add-layer-dialog";
import { SettingsDialog } from "@/components/settings-dialog";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Settings } from "lucide-react";
import MapPage from "@/pages/map-page";
import { useState } from "react";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-theme-toggle">
      {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </Button>
  );
}

function AppLayout() {
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState("select");
  const [addLayerDialogOpen, setAddLayerDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar
          onLayerToggle={() => {}}
          onLayerSelect={setSelectedLayerId}
          onAddLayer={() => setAddLayerDialogOpen(true)}
          onToolSelect={setActiveTool}
          onSettingsOpen={() => setSettingsOpen(true)}
          selectedLayerId={selectedLayerId}
          activeTool={activeTool}
        />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-1 p-2 border-b h-11">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <span className="text-sm font-medium text-muted-foreground hidden sm:inline">GIS Workspace</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSettingsOpen(true)}
                data-testid="button-settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-hidden relative">
            <MapPage
              selectedLayerId={selectedLayerId}
              activeTool={activeTool}
            />
          </main>
        </div>
      </div>
      <AddLayerDialog open={addLayerDialogOpen} onOpenChange={setAddLayerDialogOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AppLayout />
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
