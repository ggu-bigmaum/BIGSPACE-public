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
import AuthPage from "@/pages/auth-page";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Route, Switch, Redirect } from "wouter";
import { Loader2 } from "lucide-react";

function MapLayout() {
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [addLayerDialogOpen, setAddLayerDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [radiusOpen, setRadiusOpen] = useState(false);
  const [mapScale, setMapScale] = useState(0);

  const style = {
    "--sidebar-width": "19rem",
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
          onRadiusOpen={() => setRadiusOpen(true)}
          onAddLayer={() => setAddLayerDialogOpen(true)}
          selectedLayerId={selectedLayerId}
        />
        <main className="flex-1 min-w-0 overflow-hidden relative">
          <MapPage
            selectedLayerId={selectedLayerId}
            analysisOpen={analysisOpen}
            onAnalysisClose={() => setAnalysisOpen(false)}
            radiusOpen={radiusOpen}
            onRadiusClose={() => setRadiusOpen(false)}
            onScaleChange={setMapScale}
          />
        </main>
      </div>
      <AddLayerDialog open={addLayerDialogOpen} onOpenChange={setAddLayerDialogOpen} />
      <SettingsPopup open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </SidebarProvider>
  );
}

/** 인증 필수 래퍼 — 미로그인 시 /auth로 리다이렉트 */
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return <Component />;
}

/** 인증 페이지 래퍼 — 이미 로그인이면 /로 리다이렉트 */
function AuthRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  return <AuthPage />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/auth" component={AuthRoute} />
      <Route path="/product-info" component={ProductInfoPage} />
      <Route path="/">
        <ProtectedRoute component={MapLayout} />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
