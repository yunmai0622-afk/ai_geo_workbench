import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { RoutePageLoading } from "@/components/RoutePageLoading";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  activateProject,
  buildProjectUrl,
  getActiveProjectId,
  getSearchFromLocation,
  isProjectIdAccessible,
  resolveActiveProjectId,
} from "@/lib/activeProject";
import { nukeStaleProjectContextCache } from "@/lib/projectContextCache";
import { filterNavigableProjects } from "@shared/projectNavigation";
import {
  isProjectsListNavigationPending,
  useInvalidProjectRedirect,
} from "@/hooks/useInvalidProjectRedirect";
import {
  AiDiagnosisFlowPage,
  ContentPublishingFlowPage,
  DeliveryReportsFlowPage,
  InclusionMonitoringFlowPage,
  WeeklyContentPage,
} from "@/lib/lazyPages";
import { trpc } from "@/lib/trpc";
import NotFound from "@/pages/NotFound";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Redirect, Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { GeoIntroModal } from "./components/GeoIntroModal";
import { UserFeedbackFab } from "./components/UserFeedbackFab";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AnalysisPage, ProjectsPage, QuestionsPage, ResponsesPage, ScoresPage } from "./pages/GeoPages";
import GeoPublicContentPage from "./pages/GeoPublicContent";
import AssetCenterPage from "./pages/AssetCenter";
import DemoGeoPage from "./pages/DemoGeo";
import DemoGeoBrowsePage from "./pages/DemoGeoBrowse";
import LegacyOnboardingPage from "./pages/LegacyOnboardingPage";
import OnboardingPage from "./pages/OnboardingPage";
import AiSearchEvidencePage from "./pages/AiSearchEvidencePage";
import DeliveryReportPublicEvidencePage from "./pages/DeliveryReportPublicEvidencePage";
import DeliveryReportPublicPage from "./pages/DeliveryReportPublicPage";
import DeliveryReportSharePage from "./pages/DeliveryReportSharePage";
import LegacyAssetProgressRedirect from "./components/LegacyAssetProgressRedirect";
import ClientDashboardPage from "./pages/ClientDashboardPage";
import EnterpriseWorkspacePage from "./pages/EnterpriseWorkspacePage";
import MaturityDetailPage from "./pages/MaturityDetailPage";
import MonthlyPlanPage from "./pages/MonthlyPlanPage";
import EffectiveActionsPage from "./pages/EffectiveActionsPage";
import QuestionsLibraryPage from "./pages/QuestionsLibraryPage";
import SourceGraphPage from "./pages/SourceGraphPage";
import TemplatesPage from "./pages/TemplatesPage";
import KnowledgePage from "./pages/KnowledgePage";
import LandingPage from "./pages/LandingPage";
import PricingPage from "./pages/PricingPage";
import RegisterPage from "./pages/RegisterPage";
import SystemStatusPage from "./pages/SystemStatusPage";
import SettingsPage from "./pages/SettingsPage";
import { PublishRecordsHistoryPage } from "./pages/PublishRecordsHistoryPage";
import AdminConfigPage from "./pages/AdminConfigPage";
import AdminPublishTasksPage from "./pages/AdminPublishTasksPage";
import AdminStatsPage from "./pages/AdminStatsPage";
import AdminSubscriptionPage from "./pages/AdminSubscriptionPage";

function profileHasBrand(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return false;
  const brandName = (profile as Record<string, unknown>).brandName;
  return typeof brandName === "string" && brandName.trim().length > 0;
}

function isAdminShellPath(pathname: string): boolean {
  return (
    pathname === "/admin/config" ||
    pathname === "/admin/publish-tasks" ||
    pathname === "/admin/stats" ||
    pathname === "/admin/subscription"
  );
}

function PrivateRoutes() {
  return (
    <DashboardLayout>
      <Suspense fallback={<RoutePageLoading />}>
      <Switch>
        <Route path="/clients" component={ClientDashboardPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/admin/config" component={AdminConfigPage} />
        <Route path="/admin/publish-tasks" component={AdminPublishTasksPage} />
        <Route path="/admin/stats" component={AdminStatsPage} />
        <Route path="/admin/subscription" component={AdminSubscriptionPage} />
        <Route path="/knowledge" component={KnowledgePage} />
        <Route path="/workspace" component={EnterpriseWorkspacePage} />
        <Route path="/maturity" component={MaturityDetailPage} />
        <Route path="/monthly-plan" component={MonthlyPlanPage} />
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
        <Route path="/progress" component={LegacyAssetProgressRedirect} />
        <Route path="/asset-progress" component={LegacyAssetProgressRedirect} />
        <Route path="/assets-progress" component={LegacyAssetProgressRedirect} />
        <Route path="/asset-dashboard" component={LegacyAssetProgressRedirect} />
        <Route path="/content-generation">
          <Redirect to="/weekly" />
        </Route>
        <Route path="/content-publishing" component={ContentPublishingFlowPage} />
        <Route path="/publish-records-history" component={PublishRecordsHistoryPage} />
        <Route path="/inclusion-monitoring" component={InclusionMonitoringFlowPage} />
        <Route path="/geo/evidence/:monitoringId/:resultIndex" component={AiSearchEvidencePage} />
        <Route path="/delivery-reports" component={DeliveryReportsFlowPage} />
        <Route path="/effective-actions" component={EffectiveActionsPage} />
        <Route path="/projects" component={ProjectsPage} />
        <Route path="/assets" component={AssetCenterPage} />
        <Route path="/diagnosis" component={AiDiagnosisFlowPage} />
        <Route path="/questions" component={QuestionsLibraryPage} />
        <Route path="/brand-source-graph" component={SourceGraphPage} />
        <Route path="/source-graph">
          <Redirect to="/brand-source-graph" />
        </Route>
        <Route path="/templates" component={TemplatesPage} />
        <Route path="/responses" component={ResponsesPage} />
        <Route path="/analysis" component={AnalysisPage} />
        <Route path="/scores" component={ScoresPage} />
        <Route path="/tasks">
          <Redirect to="/weekly" />
        </Route>
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
  const [location, setLocation] = useLocation();
  const search = getSearchFromLocation(location);
  const { loading: authLoading, user } = useAuth();
  const projectsQuery = trpc.geo.projects.list.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const projectsRaw = projectsQuery.data ?? [];
  const projectsListPending = isProjectsListNavigationPending(
    {
      isLoading: projectsQuery.isLoading,
      isError: projectsQuery.isError,
      isFetched: projectsQuery.isFetched,
    },
    { authLoading, userKnown: Boolean(user) },
  );
  const projects = useMemo(() => filterNavigableProjects(projectsRaw), [projectsRaw]);
  const contextProjectId = typeof window !== "undefined" ? getActiveProjectId({ search }) : null;
  const healedLegacyCacheRef = useRef(false);

  useEffect(() => {
    nukeStaleProjectContextCache();
  }, []);

  useEffect(() => {
    if (!user || projectsListPending || projects.length === 0 || healedLegacyCacheRef.current) return;
    const resolved = resolveActiveProjectId(projects, { search });
    if (!resolved.staleContext || resolved.projectId == null) return;
    healedLegacyCacheRef.current = true;
    activateProject(resolved.projectId);
    const pathname = location.split("?")[0] || location;
    if (pathname !== "/clients" && pathname !== "/knowledge" && pathname !== "/settings" && !isAdminShellPath(pathname)) {
      setLocation(buildProjectUrl(pathname, resolved.projectId));
    }
  }, [user, projectsListPending, projects, search, location, setLocation]);

  useInvalidProjectRedirect({
    projectsLoading: projectsListPending,
    projects,
    contextProjectId,
  });
  const activeProjectId = useMemo(() => {
    if (!contextProjectId || projectsListPending) return null;
    return isProjectIdAccessible(contextProjectId, projects) ? contextProjectId : null;
  }, [contextProjectId, projects, projectsListPending]);
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
    (projectsListPending || (Boolean(activeProjectId) && summaryQuery.isLoading));

  if (user && !projectsListPending && (pathname === "/" || pathname === "/home")) {
    return <Redirect to={projects.length === 0 ? "/onboarding" : "/clients"} />;
  }

  if (profileLoading && pathname !== "/clients" && pathname !== "/knowledge" && pathname !== "/settings" && !isAdminShellPath(pathname)) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center text-gray-400">加载中...</div>
      </DashboardLayout>
    );
  }

  // 首次登录无项目时强制进入 onboarding，避免进入无上下文页面
  if (user && !projectsListPending && projects.length === 0 && pathname !== "/clients" && pathname !== "/knowledge" && pathname !== "/settings" && !isAdminShellPath(pathname) && !pathname.startsWith("/legacy/")) {
    return <Redirect to="/onboarding" />;
  }

  if (user && !projectsListPending && projects.length > 0 && !activeProjectId && pathname !== "/clients" && pathname !== "/knowledge" && pathname !== "/settings" && !isAdminShellPath(pathname) && !pathname.startsWith("/legacy/")) {
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

  return (
    <>
      <GeoIntroModal />
      <PrivateRoutes />
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/demo" component={DemoGeoPage} />
      <Route path="/demo/geo" component={DemoGeoBrowsePage} />
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
  useEffect(() => {
    nukeStaleProjectContextCache();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <UserFeedbackFab />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
