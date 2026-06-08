import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { useLocalAgentConnection } from "@/hooks/useLocalAgentConnection";
import { flattenPlatformAccountsForServerHeartbeat } from "@/lib/localAgentServerContext";
import { usePublishAccountBindCta } from "@/hooks/usePublishAccountBindCta";
import { usePublishAccountHealthCheck } from "@/hooks/usePublishAccountHealthCheck";
import { useWorkspaceHomeDisplay } from "@/hooks/useWorkspaceHomeDisplay";
import { buildProjectUrl } from "@/lib/activeProject";
import { CUSTOMER_STAGE_LABELS } from "@/lib/projectWorkspaceDisplay";
import { trpc } from "@/lib/trpc";
import { shouldShowPublishBindNav } from "@shared/globalNavVisibility";
import { resolvePageNextActionSuggestion } from "@shared/pageNextActionSuggestion";
import { resolveWorkspaceStage } from "@shared/workspaceStateMachine";
import { useMemo } from "react";
import { GeoGrowthSuggestionsPanel } from "@/components/geo/GeoGrowthSuggestionsPanel";
import { ContentProductionAssistantPanel } from "@/components/weekly/ContentProductionAssistantPanel";
import { InclusionMonitoringAssistantPanel } from "@/components/inclusion-monitoring/InclusionMonitoringAssistantPanel";
import { PublishAssistantPanel } from "@/components/publishing/PublishAssistantPanel";
import { QuestionBankAssistantPanel } from "@/components/questions/QuestionBankAssistantPanel";
import { SourceGraphAssistantPanel } from "@/components/source-graph/SourceGraphAssistantPanel";
import { useGeoGrowthSuggestions } from "@/hooks/useGeoGrowthSuggestions";
import { ProfileCompletenessLowHint } from "@/components/enterpriseProfile/ProfileCompletenessLowHint";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useMobile";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { workspaceCtaUrl } from "@shared/workspaceStateMachine";
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { ProjectNextActionMobileDock } from "./ProjectNextActionMobileDock";
import { ProjectNextActionPanel } from "./ProjectNextActionPanel";
import { ProjectWorkspaceTopBar } from "./ProjectWorkspaceTopBar";

type Props = {
  children: React.ReactNode;
};

export function EnterpriseProjectShell({ children }: Props) {
  const { selectedProjectId, selectedProject } = useActiveProjectSelection();
  const [location, setLocation] = useLocation();
  const pathname = location.split("?")[0] || location;
  const isWeeklyPage = pathname === "/weekly" || pathname === "/content-generation" || pathname === "/articles";
  const isPublishPage = pathname === "/content-publishing" || pathname === "/publish";
  const isInclusionMonitoringPage =
    pathname === "/inclusion-monitoring" || pathname === "/monitoring";
  const isQuestionsPage = pathname === "/questions";
  const isSourceGraphPage = pathname === "/brand-source-graph" || pathname === "/source-graph";
  const isMobile = useIsMobile();

  const summaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );

  const boundPublishAccountCount = summaryQuery.data?.boundPublishAccountCount ?? 0;
  const platformAccountsQuery = trpc.geo.platformAccounts.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const flattenedPlatformAccounts = useMemo(
    () => flattenPlatformAccountsForServerHeartbeat(platformAccountsQuery.data?.accounts ?? []),
    [platformAccountsQuery.data?.accounts],
  );
  const {
    status: localAgentConnectionStatus,
    resolvedState: localAgentResolvedState,
    localAgentOnline,
    localAgentConnectedOnline,
    accountSnapshot,
    checkConnection,
    checking: localAgentChecking,
  } = useLocalAgentConnection({
    boundPublishAccountCount,
    platformAccounts: flattenedPlatformAccounts,
  });

  const { checking: accountHealthChecking, runCheck: runAccountHealthCheck } =
    usePublishAccountHealthCheck(selectedProjectId ?? null, Boolean(selectedProjectId));

  const publishAccountBindCta = usePublishAccountBindCta({
    projectId: selectedProjectId,
    boundPublishAccountCount,
    localAgentConnectionStatus,
    localAgentConnectedOnline,
    localAgentResolvedState,
    localAccountSnapshotEmpty: accountSnapshot.length === 0,
    checking: localAgentChecking || accountHealthChecking,
    checkConnection,
    refreshAccountStatus: async () => {
      const result = await checkConnection();
      if (result.online) {
        await runAccountHealthCheck({ detectSessions: true });
      }
    },
  });

  const resolution = useMemo(() => {
    const m = summaryQuery.data;
    if (!m || !selectedProjectId) return null;
    return resolveWorkspaceStage({
      ...m,
      localAgentOnline,
      localAgentConnectionStatus,
      localAccountSnapshotEmpty: accountSnapshot.length === 0,
    });
  }, [summaryQuery.data, selectedProjectId, localAgentOnline, localAgentConnectionStatus, accountSnapshot]);

  const homeDisplay = useWorkspaceHomeDisplay(selectedProjectId, summaryQuery.data);
  const growthSuggestions = useGeoGrowthSuggestions(selectedProjectId, Boolean(selectedProjectId));

  const recentItems = useMemo(() => {
    const m = summaryQuery.data;
    if (!m) return [];
    const items: { label: string; detail?: string }[] = [];
    if (m.articleCount > 0) {
      items.push({ label: "内容资产", detail: `${m.articleCount} 篇` });
    }
    if (m.publishRecordCount > 0) {
      items.push({ label: "发布记录", detail: `${m.publishRecordCount} 次` });
    }
    if (m.aiTestResultCount > 0) {
      const rate =
        m.brandMentionRate != null ? `提及率 ${Math.round(m.brandMentionRate * 100)}%` : `${m.aiTestResultCount} 条`;
      items.push({ label: "AI 实测", detail: rate });
    }
    if (m.geoScore != null) {
      items.push({ label: "GEO 评分", detail: `${m.geoScore} 分` });
    }
    return items.slice(0, 4);
  }, [summaryQuery.data]);

  const stageLabel = resolution ? CUSTOMER_STAGE_LABELS[resolution.currentStageId] : null;

  const ctaStageForTopBar = useMemo(() => {
    const stage = resolution?.currentStage ?? null;
    if (!stage) return null;
    if (stage.id === "bind_publish_env" && !shouldShowPublishBindNav(pathname)) {
      return null;
    }
    return stage;
  }, [resolution?.currentStage, pathname]);

  const usePublishBindCtaHandler = ctaStageForTopBar?.id === "bind_publish_env";

  const pageNextAction = useMemo(() => {
    const m = summaryQuery.data;
    if (!m || pathname === "/workspace" || pathname === "/flow") return null;
    return resolvePageNextActionSuggestion(pathname, m);
  }, [summaryQuery.data, pathname]);

  const pageNextActionPath =
    pageNextAction && selectedProjectId
      ? buildProjectUrl(pageNextAction.ctaPath, selectedProjectId)
      : null;

  const panelMainChain =
    pageNextAction && pathname !== "/workspace" && pathname !== "/flow"
      ? null
      : homeDisplay.mainChainNextAction;

  const ctaLabel =
    pageNextAction?.ctaLabel ??
    homeDisplay.mainChainNextAction?.ctaLabel ??
    ctaStageForTopBar?.ctaLabel;
  const ctaPath =
    pageNextActionPath ??
    homeDisplay.mainChainNextAction?.ctaPath ??
    (ctaStageForTopBar && selectedProjectId ? workspaceCtaUrl(selectedProjectId, ctaStageForTopBar) : null);
  const publishBindMobileLabel = usePublishBindCtaHandler
    ? publishAccountBindCta.ctaLabel
    : ctaLabel;
  const mobileDockSummary = ctaLabel ?? stageLabel ?? "查看当前阶段建议";

  const publishAssistantPanelProps = {
    publishAccountBindCtaLabel: publishAccountBindCta.ctaLabel,
    onPublishAccountBindCta: () => void publishAccountBindCta.handlePublishAccountBindCta(),
    publishAccountBindChecking: publishAccountBindCta.checking,
  };
  const publishAssistantPanel = <PublishAssistantPanel {...publishAssistantPanelProps} />;
  const contentProductionAssistantPanel = <ContentProductionAssistantPanel />;
  const inclusionMonitoringAssistantPanel = <InclusionMonitoringAssistantPanel />;
  const questionBankAssistantPanel = <QuestionBankAssistantPanel />;
  const sourceGraphAssistantPanel = <SourceGraphAssistantPanel />;

  const nextActionPanel = (
    <ProjectNextActionPanel
      projectId={selectedProjectId}
      stage={resolution?.currentStage ?? null}
      mainChainNextAction={panelMainChain}
      pageNextAction={pageNextAction}
      pageNextActionPath={pageNextActionPath}
      blockerReason={resolution?.blockerReasons[0] ?? null}
      riskHints={resolution?.riskHints ?? []}
      recentItems={recentItems}
      loading={(summaryQuery.isLoading || homeDisplay.loading) && Boolean(selectedProjectId)}
      localAgentConnectionStatus={localAgentConnectionStatus}
      onCheckLocalAgentConnection={() => void checkConnection()}
    />
  );

  const projectGrowthSidebarPanel = (
    <>
      {nextActionPanel}
      <GeoGrowthSuggestionsPanel
        projectId={selectedProjectId}
        suggestions={growthSuggestions.suggestions}
        loading={growthSuggestions.loading}
        variant="sidebar"
      />
    </>
  );

  const sidebarPanel = isPublishPage
    ? publishAssistantPanel
    : isWeeklyPage
      ? contentProductionAssistantPanel
      : isInclusionMonitoringPage
        ? inclusionMonitoringAssistantPanel
        : isQuestionsPage
          ? questionBankAssistantPanel
          : isSourceGraphPage
            ? sourceGraphAssistantPanel
            : projectGrowthSidebarPanel;

  return (
    <div className="space-y-0" data-testid="enterprise-project-shell">
      <ProjectWorkspaceTopBar
        enterpriseName={selectedProject?.enterpriseName}
        stageLabel={stageLabel}
        geoScore={summaryQuery.data?.geoScore ?? null}
        ctaStage={ctaStageForTopBar}
        projectId={selectedProjectId}
        loading={summaryQuery.isLoading && Boolean(selectedProjectId)}
        onCtaClick={
          usePublishBindCtaHandler
            ? () => void publishAccountBindCta.handlePublishAccountBindCta()
            : undefined
        }
        ctaLabelOverride={usePublishBindCtaHandler ? publishAccountBindCta.ctaLabel : undefined}
      />
      {publishAccountBindCta.dialog}
      <ProfileCompletenessLowHint projectId={selectedProjectId ?? null} className="mt-4" />
      <div className="flex gap-6 pt-6">
        <div className={isMobile ? "min-w-0 flex-1 pb-28" : "min-w-0 flex-1"}>
          {isMobile && publishBindMobileLabel && selectedProjectId && (usePublishBindCtaHandler || ctaPath) ? (
            <div
              className="mb-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 lg:hidden"
              data-testid="next-action-mobile-inline-cta"
            >
              <p className="text-xs font-medium text-blue-800">当前建议</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-800">{publishBindMobileLabel}</p>
              <Button
                type="button"
                className={`mt-3 w-full ${geoP0Brand.primary}`}
                data-testid="next-action-mobile-inline-button"
                onClick={() => {
                  if (usePublishBindCtaHandler) {
                    void publishAccountBindCta.handlePublishAccountBindCta();
                    return;
                  }
                  if (ctaPath) setLocation(ctaPath);
                }}
              >
                {publishBindMobileLabel}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          ) : null}
          {children}
        </div>
        <div className="hidden shrink-0 lg:block" style={{ width: 300 }}>
          <div className="sticky top-6 space-y-4">{sidebarPanel}</div>
        </div>
      </div>

      {isMobile ? (
        <ProjectNextActionMobileDock
          summaryLabel={
            isPublishPage
              ? "发布助手"
              : isWeeklyPage
                ? "内容生产助手"
                : isInclusionMonitoringPage
                  ? "收录复测助手"
                  : isQuestionsPage
                    ? "问题库助手"
                    : isSourceGraphPage
                      ? "信源图谱助手"
                      : mobileDockSummary
          }
        >
          {sidebarPanel}
        </ProjectNextActionMobileDock>
      ) : null}
    </div>
  );
}
