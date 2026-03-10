import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Basemap, AppSetting, Layer } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Map, Globe, Eye, EyeOff, Star, Trash2, Key, Info,
  Layers, Gauge, Plus, Cpu, Server, Cloud,
  CheckCircle2, Settings2, Sun, Moon, Palette, X,
  ChevronDown, ChevronRight, FolderOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";

type SettingsSection = "general" | "layers" | "basemaps" | "rendering" | "map" | "ml-server";

interface SettingsPopupProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS: { id: SettingsSection; label: string; icon: typeof Settings2 }[] = [
  { id: "general", label: "일반", icon: Settings2 },
  { id: "layers", label: "레이어", icon: Layers },
  { id: "basemaps", label: "배경 지도", icon: Globe },
  { id: "rendering", label: "렌더링", icon: Gauge },
  { id: "map", label: "지도", icon: Map },
  { id: "ml-server", label: "ML 연산", icon: Cpu },
];

function BasemapCard({ basemap, onUpdate, onDelete, onSetDefault }: {
  basemap: Basemap;
  onUpdate: (id: string, updates: Partial<Basemap>) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState(basemap.apiKey || "");

  const providerColors: Record<string, string> = {
    osm: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    vworld: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    naver: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    kakao: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    custom: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  const needsApiKey = basemap.provider !== "osm";

  return (
    <div className={`border rounded-lg p-4 space-y-3 transition-colors ${basemap.enabled ? "border-border" : "border-border/50 opacity-60"}`}
      data-testid={`basemap-card-${basemap.id}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{basemap.name}</span>
          <Badge className={`text-[10px] ${providerColors[basemap.provider] || providerColors.custom}`}>
            {basemap.provider.toUpperCase()}
          </Badge>
          {basemap.isDefault && (
            <Badge variant="default" className="text-[10px]">
              <Star className="w-2.5 h-2.5 mr-0.5" /> 기본
            </Badge>
          )}
        </div>
        <Switch
          checked={basemap.enabled}
          onCheckedChange={(enabled) => onUpdate(basemap.id, { enabled })}
          className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
          data-testid={`switch-basemap-enabled-${basemap.id}`}
        />
      </div>

      {basemap.description && (
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          {basemap.description}
        </p>
      )}

      {needsApiKey && (
        <div className="space-y-1.5">
          <Label className="text-[11px] flex items-center gap-1">
            <Key className="w-3 h-3" /> API 키
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type={showApiKey ? "text" : "password"}
              value={editingKey ? apiKeyValue : (basemap.apiKey || "")}
              placeholder="API 키를 입력하세요"
              className="text-xs h-8"
              onChange={(e) => {
                setEditingKey(true);
                setApiKeyValue(e.target.value);
              }}
              data-testid={`input-api-key-${basemap.id}`}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => setShowApiKey(!showApiKey)}
              data-testid={`button-toggle-key-visibility-${basemap.id}`}
            >
              {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
            {editingKey && (
              <Button
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => {
                  onUpdate(basemap.id, { apiKey: apiKeyValue });
                  setEditingKey(false);
                }}
                data-testid={`button-save-api-key-${basemap.id}`}
              >
                저장
              </Button>
            )}
          </div>
        </div>
      )}

      {basemap.urlTemplate && (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">타일 URL 템플릿</Label>
          <Input
            value={basemap.urlTemplate}
            className="text-[11px] h-7 font-mono bg-muted/50"
            onChange={(e) => onUpdate(basemap.id, { urlTemplate: e.target.value })}
            data-testid={`input-url-template-${basemap.id}`}
          />
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        {!basemap.isDefault ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => onSetDefault(basemap.id)}
            data-testid={`button-set-default-${basemap.id}`}
          >
            <Star className="w-3 h-3 mr-1" /> 기본지도로 설정
          </Button>
        ) : (
          <span />
        )}
        {basemap.provider !== "osm" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] text-destructive"
            onClick={() => onDelete(basemap.id)}
            data-testid={`button-delete-basemap-${basemap.id}`}
          >
            <Trash2 className="w-3 h-3 mr-1" /> 삭제
          </Button>
        )}
      </div>
    </div>
  );
}

function SettingRow({ setting, onUpdate }: {
  setting: AppSetting;
  onUpdate: (key: string, value: any) => void;
}) {
  const label = setting.key.split(".").pop() || setting.key;
  const friendlyLabels: Record<string, string> = {
    defaultRenderMode: "기본 렌더링 모드",
    defaultFeatureLimit: "기본 피처 제한 수",
    defaultMinZoomForFeatures: "피처 표시 최소 줌",
    aggregateGridSize: "집계 그리드 크기",
    debounceMs: "디바운스 시간 (ms)",
    defaultCenter: "초기 중심 좌표",
    defaultZoom: "초기 줌 레벨",
    maxZoom: "최대 줌 레벨",
    minZoom: "최소 줌 레벨",
  };

  const renderInput = () => {
    if (label === "defaultRenderMode") {
      return (
        <Select
          value={String(setting.value)}
          onValueChange={(v) => onUpdate(setting.key, v)}
        >
          <SelectTrigger className="h-8 text-xs w-[180px]" data-testid={`select-setting-${setting.key}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto (자동)</SelectItem>
            <SelectItem value="feature">Feature (피처)</SelectItem>
            <SelectItem value="tile">Tile (타일)</SelectItem>
            <SelectItem value="aggregate">Aggregate (집계)</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (label === "defaultCenter") {
      const val = Array.isArray(setting.value) ? setting.value : [126.978, 37.5665];
      return (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step="0.001"
            value={val[0]}
            className="h-8 text-xs w-[110px]"
            onChange={(e) => onUpdate(setting.key, [parseFloat(e.target.value), val[1]])}
            data-testid={`input-setting-lng-${setting.key}`}
          />
          <span className="text-[10px] text-muted-foreground">,</span>
          <Input
            type="number"
            step="0.001"
            value={val[1]}
            className="h-8 text-xs w-[110px]"
            onChange={(e) => onUpdate(setting.key, [val[0], parseFloat(e.target.value)])}
            data-testid={`input-setting-lat-${setting.key}`}
          />
        </div>
      );
    }

    return (
      <Input
        type="number"
        value={typeof setting.value === "number" ? setting.value : String(setting.value)}
        className="h-8 text-xs w-[140px]"
        onChange={(e) => {
          const num = parseFloat(e.target.value);
          onUpdate(setting.key, isNaN(num) ? e.target.value : num);
        }}
        data-testid={`input-setting-${setting.key}`}
      />
    );
  };

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{friendlyLabels[label] || label}</div>
        {setting.description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{setting.description}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        {renderInput()}
      </div>
    </div>
  );
}

export default function SettingsPopup({ open, onClose }: SettingsPopupProps) {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [addingBasemap, setAddingBasemap] = useState(false);
  const [newBasemap, setNewBasemap] = useState({
    name: "",
    provider: "custom",
    urlTemplate: "",
    apiKey: "",
  });

  const { data: layerList = [] } = useQuery<Layer[]>({
    queryKey: ["/api/layers"],
  });

  const { data: basemapList = [] } = useQuery<Basemap[]>({
    queryKey: ["/api/basemaps"],
  });

  const { data: settingsList = [] } = useQuery<AppSetting[]>({
    queryKey: ["/api/settings"],
  });

  const updateLayerMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Layer> }) => {
      await apiRequest("PATCH", `/api/layers/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/layers"] });
      toast({ title: "레이어 설정이 저장되었습니다" });
    },
  });

  const deleteLayerMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/layers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/layers"] });
      toast({ title: "레이어가 삭제되었습니다" });
    },
  });

  const updateBasemapMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Basemap> }) => {
      await apiRequest("PATCH", `/api/basemaps/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/basemaps"] });
    },
  });

  const deleteBasemapMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/basemaps/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/basemaps"] });
      toast({ title: "배경 지도 삭제됨" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/basemaps/${id}/default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/basemaps"] });
      toast({ title: "기본 배경 지도가 변경되었습니다" });
    },
  });

  const createBasemapMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/basemaps", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/basemaps"] });
      toast({ title: "배경 지도 추가됨" });
      setAddingBasemap(false);
      setNewBasemap({ name: "", provider: "custom", urlTemplate: "", apiKey: "" });
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const existing = settingsList.find(s => s.key === key);
      await apiRequest("PUT", `/api/settings/${key}`, {
        value,
        description: existing?.description,
        category: existing?.category || "general",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "설정이 저장되었습니다" });
    },
  });

  if (!open) return null;

  const renderingSettings = settingsList.filter(s => s.category === "rendering");
  const mapSettings = settingsList.filter(s => s.category === "map");

  const renderContent = () => {
    switch (activeSection) {
      case "general":
        return <GeneralSection theme={theme} setTheme={setTheme} />;
      case "layers":
        return (
          <LayersSection
            layers={layerList}
            onUpdate={(id, updates) => updateLayerMutation.mutate({ id, updates })}
            onDelete={(id) => deleteLayerMutation.mutate(id)}
          />
        );
      case "basemaps":
        return (
          <BasemapsSection
            basemapList={basemapList}
            addingBasemap={addingBasemap}
            setAddingBasemap={setAddingBasemap}
            newBasemap={newBasemap}
            setNewBasemap={setNewBasemap}
            onUpdate={(id, updates) => updateBasemapMutation.mutate({ id, updates })}
            onDelete={(id) => deleteBasemapMutation.mutate(id)}
            onSetDefault={(id) => setDefaultMutation.mutate(id)}
            onCreate={(data) => createBasemapMutation.mutate(data)}
          />
        );
      case "rendering":
        return (
          <RenderingSection
            settings={renderingSettings}
            onUpdate={(key, value) => updateSettingMutation.mutate({ key, value })}
          />
        );
      case "map":
        return (
          <MapSection
            settings={mapSettings}
            onUpdate={(key, value) => updateSettingMutation.mutate({ key, value })}
          />
        );
      case "ml-server":
        return <MLServerSection />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50" data-testid="settings-popup">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center pt-[15px] pl-[15px] pr-[15px] pb-[15px]">
        <div className="relative w-full h-full bg-background rounded-xl border shadow-2xl flex overflow-hidden">
          <div className="w-52 border-r bg-card/80 flex flex-col flex-shrink-0">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-1">
                <h1 className="text-lg font-semibold flex items-center gap-2">
                  <Settings2 className="w-5 h-5" />
                  설정
                </h1>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose} data-testid="button-close-settings">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">시스템 설정을 관리합니다</p>
            </div>

            <nav className="flex-1 p-2 space-y-0.5">
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                    onClick={() => setActiveSection(item.id)}
                    data-testid={`nav-${item.id}`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl p-6">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneralSection({ theme, setTheme }: { theme: string; setTheme: (t: "light" | "dark") => void }) {
  const [badgeStyle, setBadgeStyle] = useState(() => localStorage.getItem("layerBadgeStyle") || "dot");

  const handleBadgeStyleChange = (style: string) => {
    setBadgeStyle(style);
    localStorage.setItem("layerBadgeStyle", style);
    window.dispatchEvent(new CustomEvent("badgeStyleChange", { detail: style }));
  };

  const badgeStyles = [
    { id: "pill", label: "Pill 채움", description: "불투명 배경에 흰색 글자" },
    { id: "icon", label: "아이콘+텍스트", description: "아이콘과 축약 텍스트 조합" },
    { id: "dot", label: "도트+라벨", description: "색상 점과 한글 라벨" },
    { id: "underline", label: "밑줄 강조", description: "하단 컬러 바와 텍스트" },
    { id: "gradient", label: "그라데이션", description: "그라데이션 배경 칩" },
  ];

  return (
    <div className="space-y-6" data-testid="section-general">
      <div>
        <h2 className="text-xl font-semibold">일반 설정</h2>
        <p className="text-sm text-muted-foreground mt-1">애플리케이션의 기본 설정을 관리합니다.</p>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Palette className="w-4 h-4" />
            테마 설정
          </h3>
          <p className="text-[11px] text-muted-foreground mb-4">화면의 밝기와 색상 테마를 선택합니다.</p>

          <div className="grid grid-cols-2 gap-3">
            <button
              className={`border rounded-lg p-4 text-left transition-all ${
                theme === "light"
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-muted-foreground/30"
              }`}
              onClick={() => setTheme("light")}
              data-testid="button-theme-light"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                  <Sun className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <div className="text-sm font-medium">화이트 테마</div>
                  <div className="text-[10px] text-muted-foreground">밝은 배경, 어두운 텍스트</div>
                </div>
              </div>
              <div className="flex gap-1">
                <div className="w-6 h-4 rounded-sm bg-white border border-gray-200" />
                <div className="w-6 h-4 rounded-sm bg-gray-100" />
                <div className="w-6 h-4 rounded-sm bg-gray-200" />
                <div className="w-6 h-4 rounded-sm bg-teal-500" />
                <div className="w-6 h-4 rounded-sm bg-gray-800" />
              </div>
              {theme === "light" && (
                <Badge className="mt-2 text-[9px]">현재 적용 중</Badge>
              )}
            </button>

            <button
              className={`border rounded-lg p-4 text-left transition-all ${
                theme === "dark"
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-muted-foreground/30"
              }`}
              onClick={() => setTheme("dark")}
              data-testid="button-theme-dark"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gray-900 border border-gray-700 flex items-center justify-center">
                  <Moon className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <div className="text-sm font-medium">다크 테마</div>
                  <div className="text-[10px] text-muted-foreground">어두운 배경, 밝은 텍스트</div>
                </div>
              </div>
              <div className="flex gap-1">
                <div className="w-6 h-4 rounded-sm bg-gray-900 border border-gray-700" />
                <div className="w-6 h-4 rounded-sm bg-gray-800" />
                <div className="w-6 h-4 rounded-sm bg-gray-700" />
                <div className="w-6 h-4 rounded-sm bg-cyan-500" />
                <div className="w-6 h-4 rounded-sm bg-gray-200" />
              </div>
              {theme === "dark" && (
                <Badge className="mt-2 text-[9px]">현재 적용 중</Badge>
              )}
            </button>
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4" />
            지도 종류 표시 아이콘
          </h3>
          <p className="text-[11px] text-muted-foreground mb-4">사이드바 레이어 목록에 표시되는 종류 배지 스타일을 선택합니다.</p>

          <div className="space-y-2">
            {badgeStyles.map((style) => (
              <button
                key={style.id}
                className={`w-full flex items-center gap-3 border rounded-lg px-4 py-3 text-left transition-all ${
                  badgeStyle === style.id
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-muted-foreground/30"
                }`}
                onClick={() => handleBadgeStyleChange(style.id)}
                data-testid={`button-badge-style-${style.id}`}
              >
                <div className="flex items-center gap-2 w-32 flex-shrink-0">
                  {style.id === "pill" && (
                    <>
                      <span className="inline-flex items-center justify-center h-5 px-2 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-sm">V</span>
                      <span className="inline-flex items-center justify-center h-5 px-2 rounded-full bg-violet-500 text-white text-[10px] font-bold shadow-sm">R</span>
                    </>
                  )}
                  {style.id === "icon" && (
                    <>
                      <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-emerald-500/15 text-emerald-500 text-[10px] font-semibold border border-emerald-500/25">
                        <Layers className="w-3 h-3" />V
                      </span>
                      <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-violet-500/15 text-violet-500 text-[10px] font-semibold border border-violet-500/25">
                        <Layers className="w-3 h-3" />R
                      </span>
                    </>
                  )}
                  {style.id === "dot" && (
                    <>
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />벡터
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-violet-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-violet-400" />래스터
                      </span>
                    </>
                  )}
                  {style.id === "underline" && (
                    <>
                      <span className="inline-flex flex-col items-center">
                        <span className="text-[10px] font-semibold text-emerald-400">V</span>
                        <span className="w-4 h-[2px] rounded-full bg-emerald-400 mt-0.5" />
                      </span>
                      <span className="inline-flex flex-col items-center">
                        <span className="text-[10px] font-semibold text-violet-400">R</span>
                        <span className="w-4 h-[2px] rounded-full bg-violet-400 mt-0.5" />
                      </span>
                    </>
                  )}
                  {style.id === "gradient" && (
                    <>
                      <span className="inline-flex items-center justify-center h-5 px-2 rounded-md text-[10px] font-bold text-white shadow-sm bg-gradient-to-r from-emerald-500 to-teal-400">V</span>
                      <span className="inline-flex items-center justify-center h-5 px-2 rounded-md text-[10px] font-bold text-white shadow-sm bg-gradient-to-r from-violet-500 to-purple-400">R</span>
                    </>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{style.label}</div>
                  <div className="text-[10px] text-muted-foreground">{style.description}</div>
                </div>
                {badgeStyle === style.id && (
                  <Badge className="text-[9px] flex-shrink-0">적용 중</Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Info className="w-4 h-4" />
            애플리케이션 정보
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <span className="text-muted-foreground">제품명</span>
            <span>GIS 업무 솔루션</span>
            <span className="text-muted-foreground">버전</span>
            <span>v1.0 Enterprise Edition</span>
            <span className="text-muted-foreground">좌표계</span>
            <span>EPSG:4326 (WGS84)</span>
            <span className="text-muted-foreground">데이터베이스</span>
            <span>PostgreSQL + Drizzle ORM</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BasemapsSection({ basemapList, addingBasemap, setAddingBasemap, newBasemap, setNewBasemap, onUpdate, onDelete, onSetDefault, onCreate }: {
  basemapList: Basemap[];
  addingBasemap: boolean;
  setAddingBasemap: (v: boolean) => void;
  newBasemap: { name: string; provider: string; urlTemplate: string; apiKey: string };
  setNewBasemap: (v: any) => void;
  onUpdate: (id: string, updates: Partial<Basemap>) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  onCreate: (data: any) => void;
}) {
  return (
    <div className="space-y-6" data-testid="section-basemaps">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">배경 지도 관리</h2>
          <p className="text-sm text-muted-foreground mt-1">
            배경 지도를 추가하고, API 키를 관리하고, 기본 지도를 설정합니다.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAddingBasemap(true)}
          data-testid="button-add-basemap"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> 추가
        </Button>
      </div>

      <Separator />

      {addingBasemap && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <h4 className="text-sm font-medium">새 배경 지도 추가</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">이름</Label>
              <Input
                value={newBasemap.name}
                onChange={(e) => setNewBasemap({ ...newBasemap, name: e.target.value })}
                placeholder="지도 이름"
                className="h-8 text-xs mt-1"
                data-testid="input-new-basemap-name"
              />
            </div>
            <div>
              <Label className="text-xs">제공자</Label>
              <Select
                value={newBasemap.provider}
                onValueChange={(v) => setNewBasemap({ ...newBasemap, provider: v })}
              >
                <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-new-basemap-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="osm">OSM</SelectItem>
                  <SelectItem value="vworld">VWorld</SelectItem>
                  <SelectItem value="naver">Naver</SelectItem>
                  <SelectItem value="kakao">Kakao</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">타일 URL 템플릿</Label>
            <Input
              value={newBasemap.urlTemplate}
              onChange={(e) => setNewBasemap({ ...newBasemap, urlTemplate: e.target.value })}
              placeholder="https://example.com/{z}/{x}/{y}.png"
              className="h-8 text-xs font-mono mt-1"
              data-testid="input-new-basemap-url"
            />
          </div>
          <div>
            <Label className="text-xs">API 키 (선택)</Label>
            <Input
              value={newBasemap.apiKey}
              onChange={(e) => setNewBasemap({ ...newBasemap, apiKey: e.target.value })}
              placeholder="API 키"
              className="h-8 text-xs mt-1"
              data-testid="input-new-basemap-key"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="text-xs"
              disabled={!newBasemap.name || !newBasemap.urlTemplate}
              onClick={() => onCreate({
                ...newBasemap,
                enabled: true,
                isDefault: false,
                sortOrder: basemapList.length,
                maxZoom: 18,
              })}
              data-testid="button-save-new-basemap"
            >
              저장
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={() => setAddingBasemap(false)}
              data-testid="button-cancel-new-basemap"
            >
              취소
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {basemapList.map((bm) => (
          <BasemapCard
            key={bm.id}
            basemap={bm}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onSetDefault={onSetDefault}
          />
        ))}
      </div>
    </div>
  );
}

function RenderingSection({ settings, onUpdate }: { settings: AppSetting[]; onUpdate: (key: string, value: any) => void }) {
  return (
    <div className="space-y-6" data-testid="section-rendering">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Layers className="w-5 h-5" />
          대용량 렌더링 설정
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          대용량 공간 데이터를 효율적으로 표시하기 위한 설정입니다.
          줌 레벨에 따라 집계 → 단순화 → 피처 순으로 렌더링 방식이 전환됩니다.
        </p>
      </div>
      <Separator />
      {settings.map((setting) => (
        <div key={setting.key}>
          <SettingRow setting={setting} onUpdate={onUpdate} />
          <Separator />
        </div>
      ))}
      {settings.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">설정이 아직 로드되지 않았습니다.</p>
      )}
    </div>
  );
}

function MapSection({ settings, onUpdate }: { settings: AppSetting[]; onUpdate: (key: string, value: any) => void }) {
  return (
    <div className="space-y-6" data-testid="section-map">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Map className="w-5 h-5" />
          지도 기본 설정
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          지도 뷰어의 초기 표시 상태를 설정합니다. 변경 사항은 다음 페이지 로드 시 적용됩니다.
        </p>
      </div>
      <Separator />
      {settings.map((setting) => (
        <div key={setting.key}>
          <SettingRow setting={setting} onUpdate={onUpdate} />
          <Separator />
        </div>
      ))}
      {settings.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">설정이 아직 로드되지 않았습니다.</p>
      )}
    </div>
  );
}

function LayerCard({ layer, onUpdate, onDelete }: {
  layer: Layer;
  onUpdate: (id: string, updates: Partial<Layer>) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Partial<Layer>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const merged = { ...layer, ...draft };

  const debouncedUpdate = useCallback((field: string, value: any) => {
    setDraft(prev => ({ ...prev, [field]: value }));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDraft(prev => {
        const updates = { ...prev, [field]: value };
        onUpdate(layer.id, updates);
        return {};
      });
    }, 600);
  }, [layer.id, onUpdate]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const safeFloat = (val: string, fallback: number) => {
    const n = parseFloat(val);
    return isFinite(n) ? n : fallback;
  };

  const safeInt = (val: string, fallback: number) => {
    const n = parseInt(val);
    return isFinite(n) ? n : fallback;
  };

  const geometryLabels: Record<string, string> = {
    Point: "포인트",
    LineString: "라인",
    Polygon: "폴리곤",
    MultiPoint: "멀티포인트",
    MultiLineString: "멀티라인",
    MultiPolygon: "멀티폴리곤",
  };

  const renderModeLabels: Record<string, string> = {
    auto: "자동",
    feature: "피처",
    tile: "타일",
    aggregate: "집계",
  };

  return (
    <div className="border rounded-lg p-3 space-y-3" data-testid={`layer-card-${layer.id}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-md border flex items-center justify-center"
            style={{ backgroundColor: merged.fillColor, borderColor: merged.strokeColor }}
          >
            <Layers className="w-4 h-4" style={{ color: merged.strokeColor }} />
          </div>
          <div>
            <div className="text-sm font-medium">{layer.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[9px]">
                {geometryLabels[layer.geometryType] || layer.geometryType}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                피처 {layer.featureCount.toLocaleString()}개
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => onUpdate(layer.id, { visible: !layer.visible })}
            data-testid={`button-toggle-visibility-${layer.id}`}
          >
            {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
          </Button>
        </div>
      </div>

      {layer.description && (
        <p className="text-xs text-muted-foreground">{layer.description}</p>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">카테고리</Label>
          <Input
            value={merged.category ?? layer.category}
            onChange={(e) => debouncedUpdate("category", e.target.value || "일반")}
            className="h-8 text-xs"
            placeholder="카테고리 입력"
            data-testid={`input-category-${layer.id}`}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">렌더링 모드</Label>
          <Select
            value={merged.renderMode}
            onValueChange={(v) => onUpdate(layer.id, { renderMode: v })}
          >
            <SelectTrigger className="h-8 text-xs" data-testid={`select-render-mode-${layer.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(renderModeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">불투명도</Label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={merged.opacity}
              onChange={(e) => debouncedUpdate("opacity", safeFloat(e.target.value, layer.opacity))}
              className="flex-1 h-2 accent-primary"
              data-testid={`range-opacity-${layer.id}`}
            />
            <span className="text-[10px] text-muted-foreground w-8 text-right">
              {Math.round((merged.opacity ?? layer.opacity) * 100)}%
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">선 색상</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={merged.strokeColor}
              onChange={(e) => debouncedUpdate("strokeColor", e.target.value)}
              className="w-8 h-8 rounded border cursor-pointer"
              data-testid={`color-stroke-${layer.id}`}
            />
            <span className="text-[10px] font-mono text-muted-foreground">{merged.strokeColor}</span>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">채우기 색상</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={(merged.fillColor ?? "").substring(0, 7)}
              onChange={(e) => debouncedUpdate("fillColor", e.target.value + "80")}
              className="w-8 h-8 rounded border cursor-pointer"
              data-testid={`color-fill-${layer.id}`}
            />
            <span className="text-[10px] font-mono text-muted-foreground">{merged.fillColor}</span>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">선 두께</Label>
          <Input
            type="number"
            min="0.5"
            max="10"
            step="0.5"
            value={merged.strokeWidth}
            onChange={(e) => debouncedUpdate("strokeWidth", safeFloat(e.target.value, layer.strokeWidth))}
            className="h-8 text-xs"
            data-testid={`input-stroke-width-${layer.id}`}
          />
        </div>

        {layer.geometryType === "Point" && (
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">포인트 반경</Label>
            <Input
              type="number"
              min="1"
              max="20"
              step="1"
              value={merged.pointRadius}
              onChange={(e) => debouncedUpdate("pointRadius", safeFloat(e.target.value, layer.pointRadius))}
              className="h-8 text-xs"
              data-testid={`input-point-radius-${layer.id}`}
            />
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">피처 제한 수</Label>
          <Input
            type="number"
            min="100"
            max="50000"
            step="100"
            value={merged.featureLimit}
            onChange={(e) => debouncedUpdate("featureLimit", safeInt(e.target.value, layer.featureLimit))}
            className="h-8 text-xs"
            data-testid={`input-feature-limit-${layer.id}`}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">피처 표시 최소 줌</Label>
          <Input
            type="number"
            min="0"
            max="22"
            step="1"
            value={merged.minZoomForFeatures}
            onChange={(e) => debouncedUpdate("minZoomForFeatures", safeInt(e.target.value, layer.minZoomForFeatures))}
            className="h-8 text-xs"
            data-testid={`input-min-zoom-${layer.id}`}
          />
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={merged.tileEnabled}
              onCheckedChange={(v) => onUpdate(layer.id, { tileEnabled: v })}
              className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
              data-testid={`switch-tile-enabled-${layer.id}`}
            />
            <Label className="text-xs">타일 캐싱</Label>
          </div>
          {merged.tileEnabled && (
            <div className="flex items-center gap-1">
              <Label className="text-[10px] text-muted-foreground">최대 줌:</Label>
              <Input
                type="number"
                min="0"
                max="22"
                value={merged.tileMaxZoom}
                onChange={(e) => debouncedUpdate("tileMaxZoom", safeInt(e.target.value, layer.tileMaxZoom))}
                className="h-6 text-[10px] w-14"
                data-testid={`input-tile-max-zoom-${layer.id}`}
              />
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] text-destructive hover:text-destructive"
          onClick={() => onDelete(layer.id)}
          data-testid={`button-delete-layer-${layer.id}`}
        >
          <Trash2 className="w-3 h-3 mr-1" /> 삭제
        </Button>
      </div>
    </div>
  );
}

function LayersSection({ layers, onUpdate, onDelete }: {
  layers: Layer[];
  onUpdate: (id: string, updates: Partial<Layer>) => void;
  onDelete: (id: string) => void;
}) {
  const grouped = layers.reduce<Record<string, Layer[]>>((acc, layer) => {
    const cat = layer.category || "일반";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(layer);
    return acc;
  }, {});
  const categories = Object.keys(grouped);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    categories.forEach(c => { init[c] = true; });
    return init;
  });

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const allExpanded = categories.every(c => expandedCats[c] !== false);
  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    categories.forEach(c => { next[c] = !allExpanded; });
    setExpandedCats(next);
  };

  return (
    <div className="space-y-4" data-testid="section-layers">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Layers className="w-5 h-5" />
            레이어 관리
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            총 {layers.length}개 레이어, {categories.length}개 카테고리
          </p>
        </div>
        {categories.length > 1 && (
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAll} data-testid="button-toggle-all-categories">
            {allExpanded ? "모두 접기" : "모두 펼치기"}
          </Button>
        )}
      </div>

      <Separator />

      {layers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">등록된 레이어가 없습니다.</p>
          <p className="text-xs mt-1">사이드바에서 새 레이어를 추가할 수 있습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const isExpanded = expandedCats[cat] !== false;
            return (
              <div key={cat} className="border rounded-lg overflow-hidden" data-testid={`layer-category-${cat}`}>
                <button
                  className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                  onClick={() => toggleCat(cat)}
                  data-testid={`button-toggle-category-${cat}`}
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold">{cat}</span>
                    <span className="text-[10px] text-muted-foreground">{grouped[cat].length}개</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
                {isExpanded && (
                  <div className="p-3 space-y-3">
                    {grouped[cat].map((layer) => (
                      <LayerCard
                        key={layer.id}
                        layer={layer}
                        onUpdate={onUpdate}
                        onDelete={onDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MLServerSection() {
  return (
    <div className="space-y-6" data-testid="section-ml-server">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Cpu className="w-5 h-5" />
          ML 연산 서버 설정
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          머신러닝 연산 서버를 연결하여 공간 데이터 기반 AI 분석 기능을 활용합니다.
        </p>
      </div>

      <Separator />

      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">연결 방식</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="border rounded-lg p-4 space-y-2 border-primary/50 bg-primary/5" data-testid="ml-option-cloud">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">클라우드 ML</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                AWS SageMaker, Google Vertex AI, Azure ML 등 관리형 서비스의 REST API를 호출하여 추론 수행.
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                <Badge variant="outline" className="text-[9px]">권장</Badge>
                <Badge variant="outline" className="text-[9px] border-green-500/50 text-green-600 dark:text-green-400">구현 가능</Badge>
              </div>
            </div>
            <div className="border rounded-lg p-4 space-y-2" data-testid="ml-option-onpremise">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">온프레미스</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                기관 내부망 GPU 서버에 직접 연결. 데이터가 외부로 나가지 않아 보안 요건 충족.
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                <Badge variant="outline" className="text-[9px]">공공기관</Badge>
                <Badge variant="outline" className="text-[9px] border-yellow-500/50 text-yellow-600 dark:text-yellow-400">인프라 필요</Badge>
              </div>
            </div>
            <div className="border rounded-lg p-4 space-y-2" data-testid="ml-option-lightweight">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">경량 추론</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                ONNX Runtime 또는 TensorFlow.js 기반 CPU 추론. 소형 모델의 간단한 분류/예측에만 적합.
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                <Badge variant="outline" className="text-[9px]">소규모</Badge>
                <Badge variant="outline" className="text-[9px] border-orange-500/50 text-orange-600 dark:text-orange-400">제한적</Badge>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">서버 연결 정보</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">ML 서버 엔드포인트 URL</Label>
              <Input
                placeholder="https://ml-server.example.com/api/v1"
                className="h-9 text-xs font-mono mt-1"
                disabled
                data-testid="input-ml-endpoint"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">인증 방식</Label>
                <Select disabled>
                  <SelectTrigger className="h-9 text-xs mt-1" data-testid="select-ml-auth-type">
                    <SelectValue placeholder="선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api-key">API 키</SelectItem>
                    <SelectItem value="bearer">Bearer 토큰</SelectItem>
                    <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                    <SelectItem value="mtls">mTLS 인증서</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">API 키 / 토큰</Label>
                <Input type="password" placeholder="인증 키를 입력하세요" className="h-9 text-xs mt-1" disabled data-testid="input-ml-api-key" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">연결 타임아웃 (초)</Label>
                <Input type="number" placeholder="30" className="h-9 text-xs mt-1" disabled data-testid="input-ml-timeout" />
              </div>
              <div>
                <Label className="text-xs">최대 재시도 횟수</Label>
                <Input type="number" placeholder="3" className="h-9 text-xs mt-1" disabled data-testid="input-ml-retries" />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">지원 분석 기능 (구현 가능성 검토)</h3>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">외부 ML 서버 연동 시 구현 가능 (클라우드/온프레미스 GPU 필요)</p>
            {[
              { name: "위성영상 객체 탐지 (건물, 도로, 식생 분류)", desc: "GPU 필수. YOLO/Mask R-CNN 등 사전학습 모델 활용" },
              { name: "변화 탐지 (시계열 위성영상 비교)", desc: "GPU 필수. U-Net 등 세그멘테이션 모델 활용" },
              { name: "DEM 기반 지형 자동 분류", desc: "GPU 권장. 수치표고모델 래스터 데이터 기반" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 py-2 pl-3 border-l-2 border-green-500/30">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-sm">{item.name}</span>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Badge variant="outline" className="text-[9px] border-green-500/50 text-green-600 dark:text-green-400 flex-shrink-0">API 연동</Badge>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">앱 서버 자체 구현 가능 (CPU 연산, 경량 모델)</p>
            {[
              { name: "공간 데이터 패턴 분석 (속성 기반 예측)", desc: "CPU 가능. 단순 회귀/분류 모델, ONNX 또는 TF.js", badge: "로컬 추론" },
              { name: "이상치 탐지 및 공간 클러스터링", desc: "CPU 가능. DBSCAN/K-Means 알고리즘. ML 서버 불필요", badge: "로컬 연산" },
              { name: "공간 통계 분석 (핫스팟, 밀도 추정)", desc: "CPU 가능. KDE, Getis-Ord Gi* 등 공간 통계 알고리즘", badge: "로컬 연산" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 py-2 pl-3 border-l-2 border-cyan-500/30">
                <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-sm">{item.name}</span>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Badge variant="outline" className="text-[9px] border-cyan-500/50 text-cyan-600 dark:text-cyan-400 flex-shrink-0">{item.badge}</Badge>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-5 space-y-3" data-testid="ml-status-banner">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-sm font-medium">구현 가능성 요약</p>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>• <span className="text-cyan-600 dark:text-cyan-400 font-medium">로컬 연산 3건</span> — 앱 서버에서 JavaScript로 즉시 구현 가능</p>
            <p>• <span className="text-green-600 dark:text-green-400 font-medium">API 연동 3건</span> — 외부 GPU 서버의 REST API 프록시 구조로 구현 가능</p>
            <p>• <span className="text-yellow-600 dark:text-yellow-400 font-medium">인프라 조건</span> — 영상 처리는 GPU 서버가 전제되어야 하며, 공공기관은 내부망 배치 필요</p>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground/60">
            서버 연결 설정 및 분석 결과 시각화 기능은 향후 업데이트에서 활성화됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
