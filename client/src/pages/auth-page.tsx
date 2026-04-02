import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, MapPin } from "lucide-react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export default function AuthPage() {
  const [isRegister, setIsRegister] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* 왼쪽: 폼 영역 */}
      <div className="w-full lg:w-[37%] flex flex-col bg-white px-10 py-12">
        {/* 로고 */}
        <div className="mb-auto">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-teal-600" />
            <span className="text-lg font-bold tracking-tight text-gray-800">BIGSPACE</span>
          </div>
          <p className="text-xs text-gray-400 mt-1 ml-7">선명한 시야, 더 현명한 판단</p>
        </div>

        {/* 폼 중앙 정렬 */}
        <div className="flex-1 flex flex-col justify-center w-full py-12">
          {isRegister ? (
            <RegisterForm onSwitch={() => setIsRegister(false)} />
          ) : (
            <LoginForm onSwitch={() => setIsRegister(true)} />
          )}
        </div>

        {/* 하단 카피라이트 */}
        <p className="text-xs text-gray-400 mt-auto">
          © 2026 BIGSPACE. All Rights Reserved.
        </p>
      </div>

      {/* 오른쪽: 이미지 */}
      <div
        className="hidden lg:block flex-1 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1400&auto=format&fit=crop&q=80')",
        }}
      />
    </div>
  );
}

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const { loginMutation } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

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

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Google 로그인 실패");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Google 로그인 실패", description: err.message });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-2xl font-semibold text-gray-800 mb-1">로그인</h2>
      <p className="text-sm text-gray-400 mb-8">계정 정보를 입력해주세요.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 아이디 */}
        <div className="border-b border-gray-200 pb-1">
          <input
            type="text"
            placeholder="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full outline-none text-sm text-gray-700 placeholder-gray-400 bg-transparent py-1"
            disabled={loginMutation.isPending}
            autoComplete="username"
          />
        </div>

        {/* 비밀번호 */}
        <div className="border-b border-gray-200 pb-1 flex items-center">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 outline-none text-sm text-gray-700 placeholder-gray-400 bg-transparent py-1"
            disabled={loginMutation.isPending}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Google 로그인 */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Google 계정으로 로그인
        </button>

        {/* 로그인 버튼 */}
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded text-sm tracking-widest transition-colors disabled:opacity-50"
        >
          {loginMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          ) : (
            "SIGN IN"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-gray-400 mt-6">
        계정이 없으신가요?{" "}
        <button type="button" onClick={onSwitch} className="text-teal-600 hover:underline font-medium">
          회원가입
        </button>
      </p>
    </>
  );
}

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const { registerMutation } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
    <>
      <h2 className="text-2xl font-semibold text-gray-800 mb-1">회원가입</h2>
      <p className="text-sm text-gray-400 mb-8">새 계정을 만들어 시작하세요.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="border-b border-gray-200 pb-1">
          <input
            type="text"
            placeholder="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full outline-none text-sm text-gray-700 placeholder-gray-400 bg-transparent py-1"
            disabled={registerMutation.isPending}
            autoComplete="username"
          />
        </div>

        <div className="border-b border-gray-200 pb-1 flex items-center">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="비밀번호 (8자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 outline-none text-sm text-gray-700 placeholder-gray-400 bg-transparent py-1"
            disabled={registerMutation.isPending}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="border-b border-gray-200 pb-1">
          <input
            type="password"
            placeholder="비밀번호 확인"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full outline-none text-sm text-gray-700 placeholder-gray-400 bg-transparent py-1"
            disabled={registerMutation.isPending}
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded text-sm tracking-widest transition-colors disabled:opacity-50"
        >
          {registerMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          ) : (
            "CREATE ACCOUNT"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-gray-400 mt-6">
        이미 계정이 있으신가요?{" "}
        <button type="button" onClick={onSwitch} className="text-teal-600 hover:underline font-medium">
          로그인
        </button>
      </p>
    </>
  );
}
