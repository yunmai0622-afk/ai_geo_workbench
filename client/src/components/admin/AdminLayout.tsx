import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  Building2,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Link2,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, Redirect, useLocation } from "wouter";

const ADMIN_NAV = [
  { path: "/admin/customers", label: "客户公司管理", icon: Building2 },
  { path: "/admin/users", label: "注册用户审核", icon: Users },
  { path: "/admin/subscriptions", label: "套餐与有效期", icon: CreditCard },
  { path: "/admin/projects", label: "客户项目绑定", icon: Link2 },
  { path: "/admin/delivery", label: "交付状态看板", icon: LayoutDashboard },
] as const;

export function AdminAccessGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-gray-500">
        <Spinner className="size-6 text-blue-600" />
        <p className="text-sm">加载中…</p>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/landing" />;
  }

  if (user.role !== "admin") {
    return <Redirect to="/clients" />;
  }

  return <>{children}</>;
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function AdminMetricCards({
  items,
}: {
  items: Array<{ label: string; value: string | number; description?: string }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {items.map(item => (
        <Card key={item.label} data-testid={`admin-metric-${item.label}`}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{item.value}</p>
            {item.description ? (
              <p className="mt-1 text-xs text-gray-400">{item.description}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAuth();

  return (
    <AdminAccessGuard>
      <div className="min-h-screen bg-gray-50" data-testid="admin-layout">
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
            <div>
              <p className="text-base font-semibold text-gray-900">平台运营后台</p>
              <p className="text-xs text-gray-500">管理客户公司、注册账号、套餐权限、项目绑定与交付进度</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/clients">返回客户侧</Link>
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/settings">
                  <Settings className="mr-1.5 h-4 w-4" />
                  设置
                </Link>
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={logout}>
                <LogOut className="mr-1.5 h-4 w-4" />
                退出
              </Button>
            </div>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 md:px-6">
          <aside className="hidden w-56 shrink-0 md:block">
            <nav className="space-y-1 rounded-xl border border-gray-200 bg-white p-2">
              {ADMIN_NAV.map(item => {
                const active = location === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-blue-50 font-medium text-blue-800"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                    )}
                    data-testid={`admin-nav-${item.path}`}
                  >
                    <item.icon className={cn("h-4 w-4", active ? "text-blue-600" : "text-gray-400")} />
                    {item.label}
                  </Link>
                );
              })}
              <div className="my-2 border-t border-gray-100" />
              <Link
                href="/admin/stats"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                <ClipboardList className="h-4 w-4 text-gray-400" />
                系统使用统计
              </Link>
            </nav>
          </aside>

          <main className="min-w-0 flex-1 space-y-6">{children}</main>
        </div>
      </div>
    </AdminAccessGuard>
  );
}
