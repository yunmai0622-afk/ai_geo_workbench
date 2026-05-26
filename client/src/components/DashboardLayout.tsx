import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl, isLoginConfigured } from "@/const";
import { useActiveProjectId } from "@/hooks/useActiveProject";
import { useIsMobile } from "@/hooks/useMobile";
import { buildProjectUrl } from "@/lib/activeProject";
import { trpc } from "@/lib/trpc";
import { BarChart3, Brain, Building2, FileBarChart2, FileText, LineChart, LogOut, PanelLeft, Send, Sparkles, Users2 } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { geoP0Surfaces } from "@/lib/geoP0Visual";
import { cn } from "@/lib/utils";
import { EnterpriseProjectShell } from "./project/EnterpriseProjectShell";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const PATHS_WITHOUT_PROJECT_SHELL = new Set(["/clients"]);

type MenuItem = {
  icon: typeof Sparkles;
  label: string;
  desc: string;
  path: string;
  aliases: string[];
};

const navGroups: { title: string; items: MenuItem[] }[] = [
  {
    title: "项目",
    items: [
      {
        icon: Users2,
        label: "客户管理台",
        desc: "新建与选择企业项目",
        path: "/clients",
        aliases: ["/clients"],
      },
    ],
  },
  {
    title: "增长总览",
    items: [
      {
        icon: Sparkles,
        label: "企业工作台",
        desc: "当前企业 GEO 增长驾驶舱",
        path: "/workspace",
        aliases: ["/workspace", "/flow"],
      },
    ],
  },
  {
    title: "GEO 执行",
    items: [
      {
        icon: Building2,
        label: "GEO 建档",
        desc: "完善企业基础资料",
        path: "/enterprise-profile",
        aliases: ["/enterprise-profile", "/assets", "/projects"],
      },
      {
        icon: Brain,
        label: "AI 现状诊断",
        desc: "缺口与内容方向",
        path: "/ai-diagnosis",
        aliases: ["/ai-diagnosis", "/diagnosis", "/questions", "/responses", "/analysis", "/scores"],
      },
      {
        icon: FileText,
        label: "平台化内容生产",
        desc: "生成本轮平台化内容",
        path: "/weekly",
        aliases: ["/weekly", "/content-generation", "/articles"],
      },
    ],
  },
  {
    title: "发布与复测",
    items: [
      {
        icon: Send,
        label: "发布中心",
        desc: "登记发布与任务跟进",
        path: "/content-publishing",
        aliases: ["/content-publishing", "/publish"],
      },
      {
        icon: LineChart,
        label: "收录监测",
        desc: "AI 实测与收录表现",
        path: "/inclusion-monitoring",
        aliases: ["/inclusion-monitoring", "/monitoring"],
      },
    ],
  },
  {
    title: "客户交付",
    items: [
      {
        icon: FileBarChart2,
        label: "交付报告",
        desc: "面向客户的交付物",
        path: "/delivery-reports",
        aliases: ["/delivery-reports", "/reports"],
      },
    ],
  },
];

const allMenuItems = navGroups.flatMap(g => g.items);

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 292;
const MIN_WIDTH = 230;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const utils = trpc.useUtils();
  const devLogin = trpc.auth.devLogin.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      window.location.reload();
    },
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    const loginConfigured = isLoginConfigured();
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex w-full max-w-md flex-col items-center gap-8 rounded-3xl border border-cyan-300/15 bg-white/[0.04] p-8 text-center shadow-[0_0_42px_rgba(56,189,248,0.14)]">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
              <BarChart3 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">登录后继续</h1>
            <p className="max-w-sm text-sm leading-6 text-slate-400">
              登录后可按增长总览、内容诊断、资产生产、发布记录与客户交付报告推进项目。
            </p>
          </div>
          {loginConfigured ? (
            <Button onClick={() => { window.location.href = getLoginUrl(); }} size="lg" className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">
              登录
            </Button>
          ) : (
            <div className="w-full space-y-3">
              <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">
                本地环境未配置外部 OAuth 登录参数。可使用本地开发登录进入系统验收页面；生产环境不会启用该入口。
              </div>
              <Button onClick={() => devLogin.mutate()} disabled={devLogin.isPending} size="lg" className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                {devLogin.isPending ? "正在登录" : "本地开发登录"}
              </Button>
              {devLogin.error ? <p className="text-sm leading-6 text-red-200">{devLogin.error.message}</p> : null}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { activeProjectId } = useActiveProjectId({ syncUrl: false });
  const { data: projects = [] } = trpc.geo.projects.list.useQuery();
  const activeProject = projects.find(project => project.id === activeProjectId);
  const projectName = activeProject?.enterpriseName;
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const pathname = location.split("?")[0] || location;
  const activeMenuItem = allMenuItems.find(item => item.aliases.includes(pathname));
  const isMobile = useIsMobile();
  const useProjectShell = !PATHS_WITHOUT_PROJECT_SHELL.has(pathname);
  const isClientsHub = pathname === "/clients";

  const navigateWithProject = (path: string) => {
    if (path === "/clients") {
      setLocation(path);
      return;
    }
    setLocation(buildProjectUrl(path, activeProjectId));
  };

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      {!isClientsHub ? (
        <div className="relative" ref={sidebarRef}>
          <Sidebar
            collapsible="icon"
            className={cn("border-r", geoP0Surfaces.sidebar)}
            disableTransition={isResizing}
          >
            <SidebarHeader className="h-16 justify-center border-b border-gray-200 bg-white">
              <div className="flex w-full items-center gap-3 px-2 transition-all">
                <button
                  onClick={toggleSidebar}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label="Toggle navigation"
                >
                  <PanelLeft className="h-4 w-4" />
                </button>
                {!isCollapsed ? (
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-bold text-gray-900">GEO 增长工作台</span>
                    <span className="block truncate text-[11px] text-gray-400">AI 搜索增长系统</span>
                  </div>
                ) : null}
              </div>
            </SidebarHeader>

            <SidebarContent className="gap-0 bg-white">
              {navGroups.map(group => (
                <div key={group.title} className="px-2 py-2">
                  {!isCollapsed ? (
                    <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {group.title}
                    </p>
                  ) : null}
                  <SidebarMenu className="px-0 py-0">
                    {group.items.map(item => {
                      const isActive = item.aliases.includes(pathname);
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => navigateWithProject(item.path)}
                            tooltip={item.label}
                            className={cn(
                              "mb-0.5 h-10 rounded-lg border border-transparent py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                              isActive &&
                                "border-blue-100 bg-blue-50 font-medium text-blue-800 shadow-none before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-blue-600 before:content-['']",
                            )}
                          >
                            <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-blue-600" : "text-gray-400")} />
                            {!isCollapsed ? (
                              <span className="truncate text-sm">{item.label}</span>
                            ) : null}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </div>
              ))}
            </SidebarContent>

            <SidebarFooter className="border-t border-gray-200 bg-white p-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-2 py-2 text-left hover:bg-gray-50 group-data-[collapsible=icon]:justify-center">
                    <Avatar className="h-8 w-8 border border-gray-100">
                      <AvatarFallback className="bg-gradient-to-br from-blue-50 to-blue-100 text-xs font-semibold text-blue-700">
                        {user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                      <p className="truncate text-sm font-medium text-gray-800">{user?.name || "-"}</p>
                      <p className="truncate text-xs text-gray-500">{user?.email || "-"}</p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>退出登录</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarFooter>
          </Sidebar>
          <div
            className={`absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-blue-200 ${isCollapsed ? "hidden" : ""}`}
            onMouseDown={() => {
              if (!isCollapsed) setIsResizing(true);
            }}
            style={{ zIndex: 50 }}
          />
        </div>
      ) : null}

      <SidebarInset className={isClientsHub ? "w-full max-w-none" : undefined}>
        {isMobile && !isClientsHub ? (
          <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-2">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9" />
              <span className="text-slate-900">{activeMenuItem?.label ?? "菜单"}</span>
            </div>
          </div>
        ) : null}
        {!useProjectShell && !isClientsHub ? (
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600 md:px-6"
            data-testid="current-project-bar"
          >
            <span data-testid="current-project-label">当前客户：{projectName ?? "未选择"}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="switch-client-button"
              onClick={() => setLocation("/clients")}
            >
              切换客户
            </Button>
          </div>
        ) : null}
        <main
          className={cn(
            "notranslate min-h-screen flex-1 overflow-x-hidden",
            isClientsHub
              ? cn("mx-auto w-full max-w-[1400px]", geoP0Surfaces.pageClients, "p-4 md:p-6 lg:p-8")
              : cn(geoP0Surfaces.pageProject, "p-4 md:p-6 lg:p-8"),
          )}
          translate="no"
          data-testid={isClientsHub ? "clients-hub-main" : "project-main"}
        >
          {useProjectShell ? <EnterpriseProjectShell>{children}</EnterpriseProjectShell> : children}
        </main>
      </SidebarInset>
    </>
  );
}
