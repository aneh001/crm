import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { getRoleHome } from "./components/MobileLayout";

export default function AppLogin() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const loginMutation = trpc.auth.loginWithUserAccount.useMutation({
    onSuccess: (data) => {
      // 根据角色跳转到对应首页
      const rawRoles: unknown = data.user.roles || (data.user as any).role || 'user';
      // 确保 roles 是数组格式
      const roleArray: string[] = Array.isArray(rawRoles)
        ? rawRoles
        : (typeof rawRoles === 'string' ? rawRoles.split(',') : ['user']);
      const homePath = roleArray.length > 0 ? getRoleHome(roleArray) : '/app/user';
      setTimeout(() => {
        window.location.href = homePath;
      }, 300);
    },
    onError: (error) => {
      setError(error.message || "登录失败，请检查账号和密码");
      setIsLoading(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!phone.trim()) {
      setError("请输入手机号");
      setIsLoading(false);
      return;
    }
    if (!password) {
      setError("请输入密码");
      setIsLoading(false);
      return;
    }

    try {
      await loginMutation.mutateAsync({ phone: phone.trim(), password });
    } catch {
      // 错误已在 onError 中处理
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#12101f] to-[#0a0a0f] flex flex-col items-center justify-center px-6">
      {/* Logo区域 */}
      <div className="text-center mb-10">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500 to-purple-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <span className="text-3xl font-bold text-white">瀛</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-wider">瀛姬App</h1>
        <p className="text-slate-500 text-sm mt-2">内部管理系统</p>
      </div>

      {/* 登录表单 */}
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 错误提示 */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* 手机号 */}
          <div className="space-y-2">
            <label className="text-slate-400 text-sm font-medium">手机号</label>
            <input
              type="tel"
              placeholder="请输入手机号"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(null); }}
              disabled={isLoading}
              className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
              autoComplete="tel"
              autoFocus
            />
          </div>

          {/* 密码 */}
          <div className="space-y-2">
            <label className="text-slate-400 text-sm font-medium">密码</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="请输入密码"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                disabled={isLoading}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 pr-12 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-slate-600">初始密码为 123456</p>
          </div>

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-amber-500/20"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                登录中...
              </span>
            ) : (
              "登 录"
            )}
          </button>
        </form>

        {/* 忘记密码 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => setLocation("/app/forgot-password")}
            className="text-slate-500 text-sm hover:text-amber-400 transition-colors"
          >
            忘记密码？
          </button>
        </div>

        {/* 底部信息 */}
        <div className="mt-10 text-center space-y-2">
          <p className="text-slate-700 text-xs">如需创建账号，请联系系统管理员</p>
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-700 text-xs hover:text-slate-500 transition-colors block"
          >
            沪ICP备2022034742号-2
          </a>
        </div>
      </div>
    </div>
  );
}
