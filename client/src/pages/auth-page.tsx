import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin } from "lucide-react";

export default function AuthPage() {
  return (
    <div className="min-h-screen flex">
      {/* 왼쪽: 폼 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8">
            <MapPin className="h-8 w-8 text-teal-600" />
            <h1 className="text-2xl font-bold">BIGSPACE</h1>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">로그인</TabsTrigger>
              <TabsTrigger value="register">회원가입</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <LoginForm />
            </TabsContent>

            <TabsContent value="register">
              <RegisterForm />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* 오른쪽: 제품 소개 */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-teal-600 to-teal-800 text-white items-center justify-center p-12">
        <div className="max-w-md">
          <h2 className="text-3xl font-bold mb-4">GIS 지도 플랫폼</h2>
          <p className="text-teal-100 text-lg leading-relaxed mb-6">
            공간 데이터의 조회, 분석, 시각화를 하나의 플랫폼에서.
            행정경계 기반 집계, 격자 분석, 반경 검색까지 —
            소규모 GIS 솔루션의 새로운 기준입니다.
          </p>
          <div className="space-y-3 text-teal-100">
            <Feature text="477,000+ 공간 데이터 실시간 렌더링" />
            <Feature text="시도/시군구/읍면동 행정경계 집계" />
            <Feature text="OpenLayers 기반 고성능 지도 뷰어" />
            <Feature text="다중 배경지도 (VWorld, 네이버, 카카오)" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-1.5 rounded-full bg-teal-300" />
      <span>{text}</span>
    </div>
  );
}

function LoginForm() {
  const { loginMutation } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast({ variant: "destructive", title: "아이디와 비밀번호를 입력해주세요." });
      return;
    }
    loginMutation.mutate(
      { username: username.trim(), password },
      {
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "로그인 실패",
            description: err.message.includes("401")
              ? "아이디 또는 비밀번호가 올바르지 않습니다."
              : "서버 오류가 발생했습니다.",
          });
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>로그인</CardTitle>
        <CardDescription>BIGSPACE 계정으로 로그인하세요.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-username">아이디</Label>
            <Input
              id="login-username"
              type="text"
              placeholder="아이디를 입력하세요"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={loginMutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">비밀번호</Label>
            <Input
              id="login-password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loginMutation.isPending}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                로그인 중...
              </>
            ) : (
              "로그인"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RegisterForm() {
  const { registerMutation } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast({ variant: "destructive", title: "모든 필드를 입력해주세요." });
      return;
    }
    if (password.length < 8) {
      toast({ variant: "destructive", title: "비밀번호는 8자 이상이어야 합니다." });
      return;
    }
    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "비밀번호가 일치하지 않습니다." });
      return;
    }
    registerMutation.mutate(
      { username: username.trim(), password },
      {
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "회원가입 실패",
            description: err.message.includes("409")
              ? "이미 사용 중인 아이디입니다."
              : "서버 오류가 발생했습니다.",
          });
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>회원가입</CardTitle>
        <CardDescription>새 계정을 만들어 BIGSPACE를 시작하세요.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reg-username">아이디</Label>
            <Input
              id="reg-username"
              type="text"
              placeholder="사용할 아이디"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={registerMutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-password">비밀번호</Label>
            <Input
              id="reg-password"
              type="password"
              placeholder="8자 이상"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={registerMutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-confirm">비밀번호 확인</Label>
            <Input
              id="reg-confirm"
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={registerMutation.isPending}
            />
          </div>
          <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                가입 중...
              </>
            ) : (
              "회원가입"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
