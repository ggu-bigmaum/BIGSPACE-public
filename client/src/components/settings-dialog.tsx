import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Basemap, AppSetting } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Layers, Gauge, Monitor, Plus, Cpu, Server, Cloud,
  CheckCircle2, Circle, ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
    <div className={`border rounded-lg p-3 space-y-3 transition-colors min-w-0 overflow-hidden ${basemap.enabled ? "border-border" : "border-border/50 opacity-60"}`}
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
        <div className="flex items-center gap-1">
          <Switch
            checked={basemap.enabled}
            onCheckedChange={(enabled) => onUpdate(basemap.id, { enabled })}
            data-testid={`switch-basemap-enabled-${basemap.id}`}
          />
        </div>
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
        <div className="space-y-1 min-w-0">
          <Label className="text-[11px] text-muted-foreground">타일 URL 템플릿</Label>
          <Input
            value={basemap.urlTemplate}
            className="text-[11px] h-7 font-mono bg-muted/50 w-full"
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
          <SelectTrigger className="h-8 text-xs w-[160px]" data-testid={`select-setting-${setting.key}`}>
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
            className="h-8 text-xs w-[100px]"
            onChange={(e) => onUpdate(setting.key, [parseFloat(e.target.value), val[1]])}
            data-testid={`input-setting-lng-${setting.key}`}
          />
          <span className="text-[10px] text-muted-foreground">,</span>
          <Input
            type="number"
            step="0.001"
            value={val[1]}
            className="h-8 text-xs w-[100px]"
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
        className="h-8 text-xs w-[120px]"
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

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { toast } = useToast();
  const [addingBasemap, setAddingBasemap] = useState(false);
  const [newBasemap, setNewBasemap] = useState({
    name: "",
    provider: "custom",
    urlTemplate: "",
    apiKey: "",
  });

  const { data: basemapList = [] } = useQuery<Basemap[]>({
    queryKey: ["/api/basemaps"],
  });

  const { data: settingsList = [] } = useQuery<AppSetting[]>({
    queryKey: ["/api/settings"],
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

  const renderingSettings = settingsList.filter(s => s.category === "rendering");
  const mapSettings = settingsList.filter(s => s.category === "map");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            설정
          </DialogTitle>
          <p className="text-xs text-muted-foreground">배경 지도, 렌더링, 지도 뷰어, ML 연산 서버 설정을 관리합니다.</p>
        </DialogHeader>

        <Tabs defaultValue="basemaps" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="basemaps" data-testid="tab-basemaps">
              <Globe className="w-3.5 h-3.5 mr-1.5" />
              배경 지도
            </TabsTrigger>
            <TabsTrigger value="rendering" data-testid="tab-rendering">
              <Gauge className="w-3.5 h-3.5 mr-1.5" />
              렌더링
            </TabsTrigger>
            <TabsTrigger value="map" data-testid="tab-map">
              <Map className="w-3.5 h-3.5 mr-1.5" />
              지도
            </TabsTrigger>
            <TabsTrigger value="ml-server" data-testid="tab-ml-server">
              <Cpu className="w-3.5 h-3.5 mr-1.5" />
              ML 연산
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto overflow-x-hidden mt-4">
            <TabsContent value="basemaps" className="mt-0 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">배경 지도 관리</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    배경 지도를 추가하고, API 키를 입력하고, 활성화/비활성화할 수 있습니다.
                    활성화된 지도 중 기본(기본) 지도가 먼저 표시됩니다.
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

              {addingBasemap && (
                <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <h4 className="text-xs font-medium">새 배경 지도 추가</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">이름</Label>
                      <Input
                        value={newBasemap.name}
                        onChange={(e) => setNewBasemap({ ...newBasemap, name: e.target.value })}
                        placeholder="지도 이름"
                        className="h-8 text-xs"
                        data-testid="input-new-basemap-name"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">제공자</Label>
                      <Select
                        value={newBasemap.provider}
                        onValueChange={(v) => setNewBasemap({ ...newBasemap, provider: v })}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid="select-new-basemap-provider">
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
                    <Label className="text-[11px]">타일 URL 템플릿</Label>
                    <Input
                      value={newBasemap.urlTemplate}
                      onChange={(e) => setNewBasemap({ ...newBasemap, urlTemplate: e.target.value })}
                      placeholder="https://example.com/{z}/{x}/{y}.png"
                      className="h-8 text-xs font-mono"
                      data-testid="input-new-basemap-url"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {"{z}"} = 줌 레벨, {"{x}"}/{"{y}"} = 타일 좌표, {"{apiKey}"} = API 키 자동 치환
                    </p>
                  </div>
                  <div>
                    <Label className="text-[11px]">API 키 (선택)</Label>
                    <Input
                      value={newBasemap.apiKey}
                      onChange={(e) => setNewBasemap({ ...newBasemap, apiKey: e.target.value })}
                      placeholder="API 키"
                      className="h-8 text-xs"
                      data-testid="input-new-basemap-key"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      className="text-xs"
                      disabled={!newBasemap.name || !newBasemap.urlTemplate}
                      onClick={() => createBasemapMutation.mutate({
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

              <div className="space-y-2">
                {basemapList.map((bm) => (
                  <BasemapCard
                    key={bm.id}
                    basemap={bm}
                    onUpdate={(id, updates) => updateBasemapMutation.mutate({ id, updates })}
                    onDelete={(id) => deleteBasemapMutation.mutate(id)}
                    onSetDefault={(id) => setDefaultMutation.mutate(id)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="rendering" className="mt-0 space-y-1">
              <div className="mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  대용량 렌더링 설정
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  대용량 공간 데이터를 효율적으로 표시하기 위한 설정입니다.
                  줌 레벨에 따라 집계(aggregate) → 단순화 → 피처(feature) 순으로
                  렌더링 방식이 전환되어 성능을 최적화합니다.
                </p>
              </div>
              <Separator />
              {renderingSettings.map((setting) => (
                <div key={setting.key}>
                  <SettingRow
                    setting={setting}
                    onUpdate={(key, value) => updateSettingMutation.mutate({ key, value })}
                  />
                  <Separator />
                </div>
              ))}
              {renderingSettings.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">설정이 아직 로드되지 않았습니다.</p>
              )}
            </TabsContent>

            <TabsContent value="map" className="mt-0 space-y-1">
              <div className="mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Map className="w-4 h-4" />
                  지도 기본 설정
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  지도 뷰어의 초기 표시 상태를 설정합니다.
                  변경 사항은 다음 페이지 로드 시 적용됩니다.
                </p>
              </div>
              <Separator />
              {mapSettings.map((setting) => (
                <div key={setting.key}>
                  <SettingRow
                    setting={setting}
                    onUpdate={(key, value) => updateSettingMutation.mutate({ key, value })}
                  />
                  <Separator />
                </div>
              ))}
              {mapSettings.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">설정이 아직 로드되지 않았습니다.</p>
              )}
            </TabsContent>

            <TabsContent value="ml-server" className="mt-0 space-y-4" data-testid="tab-content-ml-server">
              <div className="mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Cpu className="w-4 h-4" />
                  ML 연산 서버 설정
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  머신러닝 연산 서버를 연결하여 공간 데이터 기반 AI 분석 기능을 활용합니다.
                  외부 GPU 서버 또는 클라우드 ML 서비스와 연동할 수 있습니다.
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">연결 방식</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="border rounded-lg p-3 space-y-2 border-primary/50 bg-primary/5" data-testid="ml-option-cloud">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium">클라우드 ML</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        AWS SageMaker, Google Vertex AI, Azure ML 등 관리형 서비스의 REST API를 호출하여 추론 수행. GPU 인프라를 직접 관리할 필요 없이 사용한 만큼만 과금.
                      </p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="outline" className="text-[9px]">권장</Badge>
                        <Badge variant="outline" className="text-[9px] border-green-500/50 text-green-400">구현 가능</Badge>
                      </div>
                    </div>
                    <div className="border rounded-lg p-3 space-y-2" data-testid="ml-option-onpremise">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium">온프레미스</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        기관 내부망 GPU 서버에 직접 연결. 데이터가 외부로 나가지 않아 보안 요건 충족. 별도 ML 서버(Flask/FastAPI) 구축 필요.
                      </p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="outline" className="text-[9px]">공공기관</Badge>
                        <Badge variant="outline" className="text-[9px] border-yellow-500/50 text-yellow-400">인프라 필요</Badge>
                      </div>
                    </div>
                    <div className="border rounded-lg p-3 space-y-2" data-testid="ml-option-lightweight">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium">경량 추론</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        ONNX Runtime 또는 TensorFlow.js로 앱 서버에서 직접 CPU 추론. 소형 모델(수십MB 이하)의 간단한 분류/예측에만 적합하며, 영상 처리는 성능 한계 있음.
                      </p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="outline" className="text-[9px]">소규모</Badge>
                        <Badge variant="outline" className="text-[9px] border-orange-500/50 text-orange-400">제한적</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">서버 연결 정보</h4>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-[11px]">ML 서버 엔드포인트 URL</Label>
                      <Input
                        placeholder="https://ml-server.example.com/api/v1"
                        className="h-8 text-xs font-mono mt-1"
                        disabled
                        data-testid="input-ml-endpoint"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px]">인증 방식</Label>
                        <Select disabled>
                          <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-ml-auth-type">
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
                        <Label className="text-[11px]">API 키 / 토큰</Label>
                        <Input
                          type="password"
                          placeholder="인증 키를 입력하세요"
                          className="h-8 text-xs mt-1"
                          disabled
                          data-testid="input-ml-api-key"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px]">연결 타임아웃 (초)</Label>
                        <Input
                          type="number"
                          placeholder="30"
                          className="h-8 text-xs mt-1"
                          disabled
                          data-testid="input-ml-timeout"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">최대 재시도 횟수</Label>
                        <Input
                          type="number"
                          placeholder="3"
                          className="h-8 text-xs mt-1"
                          disabled
                          data-testid="input-ml-retries"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">지원 분석 기능 (구현 가능성 검토)</h4>

                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium pt-1 pb-0.5">외부 ML 서버 연동 시 구현 가능 (클라우드/온프레미스 GPU 필요)</p>
                    <div className="flex items-start gap-2 py-1.5 pl-2 border-l-2 border-green-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs">위성영상 객체 탐지 (건물, 도로, 식생 분류)</span>
                        <p className="text-[10px] text-muted-foreground/70">GPU 필수. YOLO/Mask R-CNN 등 사전학습 모델 활용. REST API로 이미지 전송 → 결과 GeoJSON 반환</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-green-500/50 text-green-400 flex-shrink-0">API 연동</Badge>
                    </div>
                    <div className="flex items-start gap-2 py-1.5 pl-2 border-l-2 border-green-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs">변화 탐지 (시계열 위성영상 비교)</span>
                        <p className="text-[10px] text-muted-foreground/70">GPU 필수. 두 시점 영상을 비교하여 변화 영역 추출. U-Net 등 세그멘테이션 모델 활용</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-green-500/50 text-green-400 flex-shrink-0">API 연동</Badge>
                    </div>
                    <div className="flex items-start gap-2 py-1.5 pl-2 border-l-2 border-green-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs">DEM 기반 지형 자동 분류</span>
                        <p className="text-[10px] text-muted-foreground/70">GPU 권장. 수치표고모델(DEM) 래스터 데이터를 입력으로 경사/향/지형 클래스 분류</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-green-500/50 text-green-400 flex-shrink-0">API 연동</Badge>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium pt-2 pb-0.5">앱 서버 자체 구현 가능 (CPU 연산, 경량 모델)</p>
                    <div className="flex items-start gap-2 py-1.5 pl-2 border-l-2 border-cyan-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs">공간 데이터 패턴 분석 (속성 기반 예측)</span>
                        <p className="text-[10px] text-muted-foreground/70">CPU 가능. 시설물 속성(연식, 재질 등)으로 노후도 점수 산출. 단순 회귀/분류 모델, ONNX 또는 TF.js</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-cyan-500/50 text-cyan-400 flex-shrink-0">로컬 추론</Badge>
                    </div>
                    <div className="flex items-start gap-2 py-1.5 pl-2 border-l-2 border-cyan-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs">이상치 탐지 및 공간 클러스터링</span>
                        <p className="text-[10px] text-muted-foreground/70">CPU 가능. DBSCAN/K-Means 알고리즘을 JS로 직접 구현 가능. ML 서버 불필요, 순수 수학 연산</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-cyan-500/50 text-cyan-400 flex-shrink-0">로컬 연산</Badge>
                    </div>
                    <div className="flex items-start gap-2 py-1.5 pl-2 border-l-2 border-cyan-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs">공간 통계 분석 (핫스팟, 밀도 추정)</span>
                        <p className="text-[10px] text-muted-foreground/70">CPU 가능. 커널 밀도 추정(KDE), Getis-Ord Gi* 등 공간 통계 알고리즘. ML 모델 불필요</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-cyan-500/50 text-cyan-400 flex-shrink-0">로컬 연산</Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 space-y-3" data-testid="ml-status-banner">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <p className="text-xs font-medium">구현 가능성 요약</p>
                  </div>
                  <div className="space-y-1.5 text-[10px] text-muted-foreground/80 leading-relaxed">
                    <p>• <span className="text-cyan-400 font-medium">로컬 연산 3건</span> — 공간 클러스터링, 이상치 탐지, 통계 분석은 별도 ML 서버 없이 앱 서버에서 JavaScript로 즉시 구현 가능</p>
                    <p>• <span className="text-green-400 font-medium">API 연동 3건</span> — 영상 분석(객체 탐지, 변화 탐지, 지형 분류)은 외부 GPU 서버의 REST API를 호출하는 프록시 구조로 구현 가능</p>
                    <p>• <span className="text-yellow-400 font-medium">인프라 조건</span> — 영상 처리 기능은 GPU 서버(클라우드 또는 온프레미스)가 전제되어야 하며, 공공기관의 경우 내부망 배치 필요</p>
                  </div>
                  <Separator />
                  <p className="text-[10px] text-muted-foreground/60">
                    서버 연결 설정 및 분석 결과 시각화 기능은 향후 업데이트에서 활성화됩니다.
                  </p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
