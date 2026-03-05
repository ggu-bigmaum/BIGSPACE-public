import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { AddLayerDialog } from "@/components/add-layer-dialog";
import { SettingsDialog } from "@/components/settings-dialog";
import MapPage from "@/pages/map-page";
import { useState } from "react";

function AppLayout() {
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
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
          onSettingsOpen={() => setSettingsOpen(true)}
          selectedLayerId={selectedLayerId}
        />
        <main className="flex-1 min-w-0 overflow-hidden relative">
          <MapPage
            selectedLayerId={selectedLayerId}
          />
        </main>
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
