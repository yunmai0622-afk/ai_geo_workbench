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
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { BarChart3, Brain, Building2, FileBarChart2, FileText, LogOut, PanelLeft, RadioTower, Send, Sparkles } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: Sparkles, label: "总览", desc: "项目进度与下一步", path: "/", aliases: ["/"] },
  { icon: Building2, label: "企业档案", desc: "六类资料状态", path: "/enterprise-profile", aliases: ["/enterprise-profile", "/assets", "/projects"] },
  { icon: Brain, label: "AI 诊断", desc: "问题、回答与缺口", path: "/ai-diagnosis", aliases: ["/ai-diagnosis", "/diagnosis", "/questions", "/responses", "/analysis", "/scores"] },
  { icon: FileText, label: "内容生成", desc: "三类推荐内容", path: "/content-generation", aliases: ["/content-generation", "/articles", "/tasks"] },
  { icon: Send, label: "内容发布", desc: "可发布与已发布", path: "/content-publishing", aliases: ["/content-publishing", "/publish"] },
  { icon: RadioTower, label: "收录监测", desc: "收录、提及、推荐", path: "/inclusion-monitoring", aliases: ["/inclusion-monitoring", "/monitoring"] },
  { icon: FileBarChart2, label: "交付报告", desc: "四类客户报告", path: "/delivery-reports", aliases: ["/delivery-reports", "/reports"] },
];

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

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex w-full max-w-md flex-col items-center gap-8 rounded-3xl border border-cyan-300/15 bg-white/[0.04] p-8 text-center shadow-[0_0_42px_rgba(56,189,248,0.14)]">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
              <BarChart3 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">登录后继续</h1>
            <p className="max-w-sm text-sm leading-6 text-slate-400">
              访问 AI GEO 增长工作台需要先登录。登录后可按企业档案、AI 诊断、内容生成、内容发布、收录监测、交付报告完成闭环。
            </p>
          </div>
          <Button onClick={() => { window.location.href = getLoginUrl(); }} size="lg" className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">
            登录
          </Button>
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
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.aliases.includes(location));
  const isMobile = useIsMobile();

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
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0 bg-slate-950 text-slate-100" disableTransition={isResizing}>
          <SidebarHeader className="h-20 justify-center border-b border-white/10">
            <div className="flex w-full items-center gap-3 px-2 transition-all">
              <button
                onClick={toggleSidebar}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-200 transition-colors hover:bg-cyan-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed ? (
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold tracking-tight text-white">AI GEO 增长工作台</span>
                  <span className="block truncate text-xs text-slate-400">建档 · 诊断 · 内容 · 发布 · 监测 · 报告</span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 bg-slate-950/95">
            <div className="px-4 py-4 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 group-data-[collapsible=icon]:hidden">客户增长路径</div>
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = item.aliases.includes(location);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`mb-1 h-12 rounded-2xl border border-transparent text-slate-300 transition-all hover:border-cyan-300/20 hover:bg-cyan-400/10 hover:text-cyan-100 ${isActive ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-100 shadow-[0_0_22px_rgba(56,189,248,0.14)]" : ""}`}
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-cyan-200" : "text-slate-500"}`} />
                      <span className="flex min-w-0 flex-col items-start gap-0.5 leading-none">
                        <span>{item.label}</span>
                        <span className="text-[11px] font-normal text-slate-500">{item.desc}</span>
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-white/10 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-2 text-left transition-colors hover:bg-cyan-400/10 group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                  <Avatar className="h-9 w-9 shrink-0 border border-cyan-300/20">
                    <AvatarFallback className="bg-cyan-400/10 text-xs font-medium text-cyan-100">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-sm font-medium leading-none text-white">{user?.name || "-"}</p>
                    <p className="mt-1.5 truncate text-xs text-slate-500">{user?.email || "-"}</p>
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
          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-cyan-400/25 ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-slate-950/95 px-2 text-slate-100 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-slate-900" />
              <span className="tracking-tight text-white">{activeMenuItem?.label ?? "菜单"}</span>
            </div>
          </div>
        )}
        <main className="min-h-screen flex-1 bg-slate-950 p-4 text-slate-100 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
