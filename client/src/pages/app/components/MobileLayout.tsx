import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useMemo } from "react";
import {
  Home, Users, ShoppingCart, Wallet, User,
  UserPlus, List, FileText, DollarSign,
  Calendar, BookOpen, CreditCard,
  LayoutDashboard, ClipboardCheck, TrendingUp,
} from "lucide-react";

// 角色对应的Tab配置
const ROLE_TABS: Record<string, Array<{ icon: any; label: string; path: string }>> = {
  user: [
    { icon: Home, label: "首页", path: "/app/user" },
    { icon: Calendar, label: "预约", path: "/app/user/booking" },
    { icon: ShoppingCart, label: "订单", path: "/app/user/orders" },
    { icon: Wallet, label: "钱包", path: "/app/user/wallet" },
    { icon: User, label: "我的", path: "/app/user/profile" },
  ],
  sales: [
    { icon: Home, label: "首页", path: "/app/sales" },
    { icon: UserPlus, label: "登记", path: "/app/sales/register" },
    { icon: List, label: "客户", path: "/app/sales/customers" },
    { icon: FileText, label: "订单", path: "/app/sales/orders" },
    { icon: DollarSign, label: "提成", path: "/app/sales/commission" },
  ],
  teacher: [
    { icon: Home, label: "首页", path: "/app/teacher" },
    { icon: Calendar, label: "排课", path: "/app/teacher/schedule" },
    { icon: BookOpen, label: "课程", path: "/app/teacher/courses" },
    { icon: CreditCard, label: "结算", path: "/app/teacher/settlement" },
    { icon: User, label: "我的", path: "/app/teacher/profile" },
  ],
  admin: [
    { icon: LayoutDashboard, label: "概览", path: "/app/admin" },
    { icon: ShoppingCart, label: "订单", path: "/app/admin/orders" },
    { icon: Users, label: "客户", path: "/app/admin/customers" },
    { icon: ClipboardCheck, label: "审批", path: "/app/admin/approval" },
    { icon: TrendingUp, label: "统计", path: "/app/admin/stats" },
  ],
};

// 角色首页路径
const ROLE_HOME: Record<string, string> = {
  user: "/app/user",
  sales: "/app/sales",
  teacher: "/app/teacher",
  admin: "/app/admin",
};

// 根据角色获取首页路径（优先级：admin > sales > teacher > user）
export function getRoleHome(roles: string[]): string {
  if (roles.includes("admin")) return ROLE_HOME.admin;
  if (roles.includes("sales")) return ROLE_HOME.sales;
  if (roles.includes("teacher")) return ROLE_HOME.teacher;
  return ROLE_HOME.user;
}

// 获取当前角色
export function getCurrentRole(pathname: string): string {
  if (pathname.startsWith("/app/admin")) return "admin";
  if (pathname.startsWith("/app/sales")) return "sales";
  if (pathname.startsWith("/app/teacher")) return "teacher";
  return "user";
}

interface MobileLayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
}

export default function MobileLayout({ children, hideNav }: MobileLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, loading, isAuthenticated } = useAuth();

  // 未登录跳转
  useEffect(() => {
    if (!loading && !isAuthenticated && !location.startsWith("/app/login")) {
      setLocation("/app/login");
    }
  }, [loading, isAuthenticated, location, setLocation]);

  const currentRole = getCurrentRole(location);
  const tabs = ROLE_TABS[currentRole] || ROLE_TABS.user;

  // 检查用户是否有权限访问当前角色页面
  const userRoles = useMemo(() => {
    if (!user) return [];
    const r = (user as any).roles || (user as any).role || "user";
    return typeof r === "string" ? r.split(",") : r;
  }, [user]);

  // 多角色用户：检查当前访问的角色是否在用户角色列表中
  // 如果用户没有当前角色的权限，重定向到其主角色首页
  useEffect(() => {
    if (!isAuthenticated || loading || !user) return;
    // admin角色可以访问所有页面
    if (userRoles.includes('admin')) return;
    // 检查当前角色是否在用户角色列表中
    if (currentRole !== 'user' && !userRoles.includes(currentRole)) {
      const homePath = getRoleHome(userRoles);
      setLocation(homePath);
    }
  }, [isAuthenticated, loading, user, currentRole, userRoles, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* 内容区域 */}
      <main className={`flex-1 overflow-y-auto ${hideNav ? "" : "pb-20"}`}>
        {children}
      </main>

      {/* 底部Tab导航 */}
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#111118]/95 backdrop-blur-xl border-t border-white/5">
          <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2 safe-area-pb">
            {tabs.map((tab) => {
              const isActive = location === tab.path || 
                (tab.path !== `/app/${currentRole}` && location.startsWith(tab.path));
              const Icon = tab.icon;
              return (
                <button
                  key={tab.path}
                  onClick={() => setLocation(tab.path)}
                  className={`flex flex-col items-center justify-center gap-0.5 w-16 h-14 rounded-xl transition-all duration-200 ${
                    isActive
                      ? "text-amber-400"
                      : "text-slate-500 active:text-slate-300"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                  {isActive && (
                    <div className="w-1 h-1 rounded-full bg-amber-400 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
