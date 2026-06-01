import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { RoutePageLoading } from "@/components/RoutePageLoading";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getActiveProjectId, buildProjectUrl } from "@/lib/activeProject";
import {
  AiDiagnosisFlowPage,
  ContentPublishingFlowPage,
  DeliveryReportsFlowPage,
  InclusionMonitoringFlowPage,
  WeeklyContentPage,
} from "@/lib/lazyPages";
import { trpc } from "@/lib/trpc";
import NotFound from "@/pages/NotFound";
import { Suspense } from "react";
import { Redirect, Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AnalysisPage, ProjectsPage, QuestionsPage, ResponsesPage, ScoresPage, TasksPage } from "./pages/GeoPages";
import GeoPublicContentPage from "./pages/GeoPublicContent";
import AssetCenterPage from "./pages/AssetCenter";
import DemoGeoPage from "./pages/DemoGeo";
import LegacyOnboardingPage from "./pages/LegacyOnboardingPage";
import OnboardingPage from "./pages/OnboardingPage";
import AiSearchEvidencePage from "./pages/AiSearchEvidencePage";
import DeliveryReportPublicEvidencePage from "./pages/DeliveryReportPublicEvidencePage";
import DeliveryReportPublicPage from "./pages/DeliveryReportPublicPage";
import DeliveryReportSharePage from "./pages/DeliveryReportSharePage";
import ProgressPage from "./pages/ProgressPage";
import ClientDashboardPage from "./pages/ClientDashboardPage";
import EnterpriseWorkspacePage from "./pages/EnterpriseWorkspacePage";
import EffectiveActionsPage from "./pages/EffectiveActionsPage";
import QuestionsLibraryPage from "./pages/QuestionsLibraryPage";
import TemplatesPage from "./pages/TemplatesPage";
import KnowledgePage from "./pages/KnowledgePage";
import LandingPage from "./pages/LandingPage";
import PricingPage from "./pages/PricingPage";
import RegisterPage from "./pages/RegisterPage";
import SystemStatusPage from "./pages/SystemStatusPage";
import SettingsPage from "./pages/SettingsPage";
import AdminConfigPage from "./pages/AdminConfigPage";
import AdminStatsPage from "./pages/AdminStatsPage";

function profileHasBrand(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return false;
  const brandName = (profile as Record<string, unknown>).brandName;
  return typeof brandName === "string" && brandName.trim().length > 0;
}

function isAdminShellPath(pathname: string): boolean {
  return pathname === "/admin/config" || pathname === "/admin/stats";
}

function PrivateRoutes() {
  return (
    <DashboardLayout>
      <Suspense fallback={<RoutePageLoading />}>
      <Switch>
        <Route path="/clients" component={ClientDashboardPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/admin/config" component={AdminConfigPage} />
        <Route path="/admin/stats" component={AdminStatsPage} />
        <Route path="/admin/stats" component={AdminStatsPage} />
        <Route path="/knowledge" component={KnowledgePage} />
        <Route path="/workspace" component={EnterpriseWorkspacePage} />
        <Route path="/">
          <Redirect to="/clients" />
        </Route>
        <Route path="/home">
          <Redirect to="/clients" />
        </Route>
        <Route path="/flow">
          <Redirect to="/workspace" />
        </Route>
        <Route path="/enterprise-profile" component={AssetCenterPage} />
        <Route path="/asset-center">
          <Redirect to="/enterprise-profile#publish-platform-accounts" />
        </Route>
        <Route path="/ai-diagnosis" component={AiDiagnosisFlowPage} />
        <Route path="/weekly" component={WeeklyContentPage} />
        <Route path="/progress" component={ProgressPage} />
        <Route path="/content-generation">
          <Redirect to="/weekly" />
        </Route>
        <Route path="/content-publishing" component={ContentPublishingFlowPage} />
        <Route path="/inclusion-monitoring" component={InclusionMonitoringFlowPage} />
        <Route path="/geo/evidence/:monitoringId/:resultIndex" component={AiSearchEvidencePage} />
        <Route path="/delivery-reports" component={DeliveryReportsFlowPage} />
        <Route path="/effective-actions" component={EffectiveActionsPage} />
        <Route path="/projects" component={ProjectsPage} />
        <Route path="/assets" component={AssetCenterPage} />
        <Route path="/diagnosis" component={AiDiagnosisFlowPage} />
        <Route path="/questions" component={QuestionsLibraryPage} />
        <Route path="/templates" component={TemplatesPage} />
        <Route path="/responses" component={ResponsesPage} />
        <Route path="/analysis" component={AnalysisPage} />
        <Route path="/scores" component={ScoresPage} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/reports" component={DeliveryReportsFlowPage} />
        <Route path="/articles">
          <Redirect to="/weekly" />
        </Route>
        <Route path="/publish" component={ContentPublishingFlowPage} />
        <Route path="/monitoring" component={InclusionMonitoringFlowPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </DashboardLayout>
  );
}

/** 登录后基于 activeProjectId 检查企业档案，未完成引导则进入建档页 */
function AuthenticatedAppShell() {
  const [location] = useLocation();
  const { loading: authLoading, user } = useAuth();
  const { data: projects = [], isLoading: projectsLoading } = trpc.geo.projects.list.useQuery(undefined, { enabled: Boolean(user) });
  const activeProjectId = typeof window !== "undefined" ? getActiveProjectId() : null;
  const summaryQuery = trpc.geo.assetLibrary.summary.useQuery(
    { projectId: activeProjectId ?? 0 },
    { enabled: Boolean(user) && Boolean(activeProjectId) },
  );

  if (authLoading) {
    return <DashboardLayoutSkeleton />;
  }

  const pathname = location.split("?")[0] || location;
  const profileLoading =
    Boolean(user) &&
    (projectsLoading || (Boolean(activeProjectId) && summaryQuery.isLoading));

  if (profileLoading && pathname !== "/clients" && pathname !== "/knowledge" && pathname !== "/settings" && !isAdminShellPath(pathname)) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center text-gray-400">加载中...</div>
      </DashboardLayout>
    );
  }

  // P0：/clients 为唯一新建/选项目入口；无项目时仍允许进入客户项目管理台空状态
  if (user && projects.length === 0 && pathname !== "/clients" && pathname !== "/knowledge" && pathname !== "/settings" && !isAdminShellPath(pathname) && !pathname.startsWith("/legacy/")) {
    return <Redirect to="/clients" />;
  }

  if (user && projects.length > 0 && !activeProjectId && pathname !== "/clients" && pathname !== "/knowledge" && pathname !== "/settings" && !isAdminShellPath(pathname) && !pathname.startsWith("/legacy/")) {
    return <Redirect to="/clients" />;
  }

  const hasBrand = activeProjectId ? profileHasBrand(summaryQuery.data?.profile) : false;

  if (
    user &&
    activeProjectId &&
    !hasBrand &&
    pathname !== "/enterprise-profile" &&
    pathname !== "/clients" &&
    pathname !== "/knowledge" &&
    pathname !== "/settings" &&
    !isAdminShellPath(pathname) &&
    !pathname.startsWith("/legacy/")
  ) {
    return <Redirect to={buildProjectUrl("/enterprise-profile", activeProjectId)} />;
  }

  return <PrivateRoutes />;
}

function Router() {
  return (
    <Switch>
      <Route path="/demo" component={DemoGeoPage} />
      <Route path="/demo/geo" component={DemoGeoPage} />
      <Route path="/geo/content/:projectId/:articleId" component={GeoPublicContentPage} />
      <Route path="/delivery-reports/public/:token/evidence/:monitoringId/:resultIndex" component={DeliveryReportPublicEvidencePage} />
      <Route path="/delivery-reports/public/:token" component={DeliveryReportPublicPage} />
      <Route path="/delivery-reports/share/:projectId" component={DeliveryReportSharePage} />
      <Route path="/landing" component={LandingPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/status" component={SystemStatusPage} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/legacy/onboarding" component={LegacyOnboardingPage} />
      <Route component={AuthenticatedAppShell} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
