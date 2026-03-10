import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { AddLayerDialog } from "@/components/add-layer-dialog";
import SettingsPopup from "@/pages/settings-page";
import MapPage from "@/pages/map-page";
import ProductInfoPage from "@/pages/product-info";
import { useState } from "react";
import { Route, Switch } from "wouter";

function MapLayout() {
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [addLayerDialogOpen, setAddLayerDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);

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
          onSettingsOpen={() => setSettingsOpen(true)}
          onAnalysisOpen={() => setAnalysisOpen(true)}
          selectedLayerId={selectedLayerId}
        />
        <main className="flex-1 min-w-0 overflow-hidden relative">
          <MapPage
            selectedLayerId={selectedLayerId}
            analysisOpen={analysisOpen}
            onAnalysisClose={() => setAnalysisOpen(false)}
          />
        </main>
      </div>
      <AddLayerDialog open={addLayerDialogOpen} onOpenChange={setAddLayerDialogOpen} />
      <SettingsPopup open={settingsOpen} onClose={() => setSettingsOpen(false)} onAddLayer={() => { setSettingsOpen(false); setAddLayerDialogOpen(true); }} />
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <Switch>
            <Route path="/product-info" component={ProductInfoPage} />
            <Route path="/" component={MapLayout} />
          </Switch>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
