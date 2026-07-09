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
import { Link, useLocation, useSearch } from "wouter";
import LoginGatePanel from "@/components/auth/LoginGatePanel";
import {
  PLATFORM_PRODUCT_NAME,
  PLATFORM_PRODUCT_SUBTITLE,
} from "@/components/auth/authMarketing";
import { useActiveProjectId } from "@/hooks/useActiveProject";
import { useIsMobile } from "@/hooks/useMobile";
import { buildProjectUrl, isProjectIdAccessible } from "@/lib/activeProject";
import { filterNavGroupsForRole, resolveNavOperatorMode } from "@shared/roleBasedNavigation";
import { canAccessOperatorAdminConsole } from "@shared/platformAdmin";
import { filterNavigableProjects } from "@shared/projectNavigation";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  Brain,
  Building2,
  FileBarChart2,
  FileText,
  Library,
  LineChart,
  ListChecks,
  Network,
  LogOut,
  PanelLeft,
  Send,
  Settings,
  Sparkles,
} from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { geoP0Surfaces } from "@/lib/geoP0Visual";
import { cn } from "@/lib/utils";
import { EnterpriseProjectShell } from "./project/EnterpriseProjectShell";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { SystemAnnouncementBanner } from "./SystemAnnouncementBanner";
import { CompanyServiceBanner } from "./CompanyServiceBanner";
import { Button } from "./ui/button";

const PATHS_WITHOUT_PROJECT_SHELL = new Set([
  "/clients",
  "/knowledge",
  "/settings",
  "/admin/config",
  "/admin/publish-tasks",
  "/admin/subscription",
  "/admin/stats",
  "/admin/customers",
  "/admin/users",
  "/admin/subscriptions",
  "/admin/projects",
  "/admin/delivery",
]);

type MenuItem = {
  key: string;
  icon: typeof Sparkles;
  label: string;
  desc: string;
  path: string;
  aliases: string[];
  activeQuery?: Record<string, string>;
};

const CONTENT_PRODUCTION_MODE = "content-production";

const navGroups: { title: string; items: MenuItem[] }[] = [
  {
    title: "客户主流程",
    items: [
      {
        key: "workspace",
        icon: Sparkles,
        label: "服务首页",
        desc: "看当前状态、服务进度和下一步动作",
        path: "/workspace",
        aliases: ["/workspace", "/flow"],
      },
      {
        key: "monthly-plan",
        icon: ListChecks,
        label: "月度优化计划",
        desc: "看本月 3 个重点服务事项",
        path: "/monthly-plan",
        aliases: ["/monthly-plan"],
      },
      {
        key: "weekly-execution",
        icon: FileText,
        label: "执行进度",
        desc: "看本月服务做到哪一步",
        path: "/weekly",
        aliases: ["/weekly", "/content-generation", "/articles"],
      },
      {
        key: "inclusion-monitoring",
        icon: LineChart,
        label: "收录与 AI 复测",
        desc: "看发布内容是否被搜索和 AI 看见",
        path: "/inclusion-monitoring",
        aliases: ["/inclusion-monitoring", "/monitoring"],
      },
      {
        key: "delivery-reports",
        icon: FileBarChart2,
        label: "交付报告",
        desc: "看本月交付证明和续费理由",
        path: "/delivery-reports",
        aliases: ["/delivery-reports", "/reports"],
      },
    ],
  },
  {
    title: "运营工具",
    items: [
      {
        key: "enterprise-profile",
        icon: Building2,
        label: "品牌资料",
        desc: "补齐企业被 AI 理解的基础信息",
        path: "/enterprise-profile",
        aliases: ["/enterprise-profile", "/assets", "/projects", "/maturity"],
      },
      {
        key: "ai-diagnosis",
        icon: Brain,
        label: "AI 能见度诊断",
        desc: "判断 AI 是否知道、描述并推荐客户",
        path: "/ai-diagnosis",
        aliases: ["/ai-diagnosis", "/diagnosis", "/responses", "/analysis", "/scores"],
      },
      {
        key: "content-production",
        icon: FileText,
        label: "内容生产与发布",
        desc: "生成、质检并推进平台内容",
        path: `/weekly?mode=${CONTENT_PRODUCTION_MODE}`,
        aliases: ["/weekly"],
        activeQuery: { mode: CONTENT_PRODUCTION_MODE },
      },
      {
        key: "content-publishing",
        icon: Send,
        label: "发布执行中心",
        desc: "适配不同平台规则并执行发布",
        path: "/content-publishing",
        aliases: ["/content-publishing", "/publish"],
      },
      {
        key: "questions",
        icon: Library,
        label: "搜索问题挖掘",
        desc: "挖掘客户真实会问的 AI 搜索问题",
        path: "/questions",
        aliases: ["/questions"],
      },
      {
        key: "brand-source-graph",
        icon: Network,
        label: "信源引用监测",
        desc: "检查公开资料和品牌证据是否被 AI 识别",
        path: "/brand-source-graph",
        aliases: ["/brand-source-graph", "/source-graph"],
      },
      {
        key: "knowledge",
        icon: BookOpen,
        label: "使用指南",
        desc: "查看系统使用说明、账号环境与操作指引",
        path: "/knowledge",
        aliases: ["/knowledge"],
      },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 292;
const MIN_WIDTH = 230;
const MAX_WIDTH = 480;

function isNavItemActive(item: MenuItem, pathname: string, searchParams: URLSearchParams): boolean {
  if (!item.aliases.includes(pathname)) return false;
  const isWeeklySingleTask = pathname === "/weekly" && Boolean(searchParams.get("questionId"));
  if (item.key === "content-production" && isWeeklySingleTask) {
    return true;
  }
  if (item.activeQuery) {
    return Object.entries(item.activeQuery).every(([key, value]) => searchParams.get(key) === value);
  }
  if (
    item.key === "weekly-execution" &&
    pathname === "/weekly" &&
    (searchParams.get("mode") === CONTENT_PRODUCTION_MODE || isWeeklySingleTask)
  ) {
    return false;
  }
  return true;
}

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

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  useEffect(() => {
    if (!loading && !user) {
      document.title = `登录 - ${PLATFORM_PRODUCT_NAME}`;
    }
  }, [loading, user]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return <LoginGatePanel />;
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
  const searchString = useSearch();
  const { activeProjectId } = useActiveProjectId();
  const { data: projectsRaw = [] } = trpc.geo.projects.list.useQuery();
  const navigableProjects = useMemo(() => filterNavigableProjects(projectsRaw), [projectsRaw]);
  const validatedProjectId = useMemo(() => {
    if (!activeProjectId) return null;
    return isProjectIdAccessible(activeProjectId, navigableProjects) ? activeProjectId : null;
  }, [activeProjectId, navigableProjects]);
  const activeProject = navigableProjects.find(project => project.id === validatedProjectId);
  const projectName = activeProject?.enterpriseName;
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const pathname = location.split("?")[0] || location;
  const searchParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const isOperatorNav = resolveNavOperatorMode(user?.role);
  const visibleNavGroups = useMemo(
    () => filterNavGroupsForRole(navGroups, isOperatorNav),
    [isOperatorNav],
  );
  const allMenuItems = useMemo(() => visibleNavGroups.flatMap(g => g.items), [visibleNavGroups]);
  const activeMenuItem = allMenuItems.find(item => isNavItemActive(item, pathname, searchParams));
  const isMobile = useIsMobile();
  const useProjectShell = !PATHS_WITHOUT_PROJECT_SHELL.has(pathname);
  const isClientsHub = pathname === "/clients";

  const navigateWithProject = (path: string) => {
    if (path === "/clients" || path.startsWith("/admin/")) {
      setLocation(path);
      return;
    }
    setLocation(buildProjectUrl(path, validatedProjectId));
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
            data-testid={isOperatorNav ? "sidebar-nav-operator" : "sidebar-nav-client"}
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
                    <span className="block truncate text-sm font-bold text-gray-900">{PLATFORM_PRODUCT_NAME}</span>
                    <span className="block truncate text-[11px] text-gray-400">{PLATFORM_PRODUCT_SUBTITLE}</span>
                  </div>
                ) : null}
              </div>
            </SidebarHeader>

            <SidebarContent className="gap-0 bg-white">
              {visibleNavGroups.map(group => (
                <div key={group.title} className="px-2 py-2">
                  {!isCollapsed ? (
                    <div className="px-2 pb-1 pt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        {group.title}
                      </p>
                      {group.title === "运营工具" ? (
                        <p className="mt-0.5 text-[10px] leading-4 text-gray-400">
                          内部交付使用，不建议客户第一轮演示
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <SidebarMenu className="px-0 py-0">
                    {group.items.map(item => {
                      const isActive = isNavItemActive(item, pathname, searchParams);
                      return (
                        <SidebarMenuItem key={item.key}>
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
              <div className="flex items-center gap-2">
                <Link href="/settings" className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-blue-600 group-data-[collapsible=icon]:hidden" data-testid="sidebar-settings-link">设置</Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-gray-200 px-2 py-2 text-left hover:bg-gray-50 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
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
                    <DropdownMenuItem asChild className="cursor-pointer"><Link href="/settings" className="flex w-full items-center"><Settings className="mr-2 h-4 w-4" /><span>设置</span></Link></DropdownMenuItem>
                    {canAccessOperatorAdminConsole(user?.role) ? (
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href="/admin/customers" className="flex w-full items-center">
                          <Building2 className="mr-2 h-4 w-4" />
                          <span>{user?.role === "admin" ? "平台运营后台" : "代运营管理台"}</span>
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>退出登录</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
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
        <SystemAnnouncementBanner />
        <CompanyServiceBanner />
        {isMobile && !isClientsHub ? (
          <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-2">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9" />
              <span className="max-w-[220px] truncate text-sm font-medium text-gray-900">
                {activeMenuItem?.label ?? "菜单"}
              </span>
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
