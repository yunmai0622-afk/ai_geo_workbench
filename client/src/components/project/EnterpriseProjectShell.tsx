import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { useWorkspaceHomeDisplay } from "@/hooks/useWorkspaceHomeDisplay";
import { buildProjectUrl } from "@/lib/activeProject";
import { checkLocalAgentHealth } from "@/lib/localAgentClient";
import { CUSTOMER_STAGE_LABELS } from "@/lib/projectWorkspaceDisplay";
import { trpc } from "@/lib/trpc";
import { shouldShowPublishBindNav } from "@shared/globalNavVisibility";
import { resolvePageNextActionSuggestion } from "@shared/pageNextActionSuggestion";
import { resolveWorkspaceStage } from "@shared/workspaceStateMachine";
import { useEffect, useMemo, useState } from "react";
import { GeoGrowthSuggestionsPanel } from "@/components/geo/GeoGrowthSuggestionsPanel";
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
  const isMobile = useIsMobile();
  const [localAgentOnline, setLocalAgentOnline] = useState<boolean | null>(null);

  const summaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const health = await checkLocalAgentHealth();
      if (!cancelled) setLocalAgentOnline(health?.ok ?? false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const resolution = useMemo(() => {
    const m = summaryQuery.data;
    if (!m || !selectedProjectId) return null;
    return resolveWorkspaceStage({ ...m, localAgentOnline });
  }, [summaryQuery.data, selectedProjectId, localAgentOnline]);

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
  const mobileDockSummary = ctaLabel ?? stageLabel ?? "查看当前阶段建议";

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
    />
  );

  return (
    <div className="space-y-0" data-testid="enterprise-project-shell">
      <ProjectWorkspaceTopBar
        enterpriseName={selectedProject?.enterpriseName}
        stageLabel={stageLabel}
        geoScore={summaryQuery.data?.geoScore ?? null}
        ctaStage={ctaStageForTopBar}
        projectId={selectedProjectId}
        loading={summaryQuery.isLoading && Boolean(selectedProjectId)}
      />
      <ProfileCompletenessLowHint projectId={selectedProjectId ?? null} className="mt-4" />
      <div className="flex gap-6 pt-6">
        <div className={isMobile ? "min-w-0 flex-1 pb-28" : "min-w-0 flex-1"}>
          {isMobile && ctaLabel && selectedProjectId && ctaPath ? (
            <div
              className="mb-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 lg:hidden"
              data-testid="next-action-mobile-inline-cta"
            >
              <p className="text-xs font-medium text-blue-800">当前建议</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-800">{ctaLabel}</p>
              <Button
                type="button"
                className={`mt-3 w-full ${geoP0Brand.primary}`}
                data-testid="next-action-mobile-inline-button"
                onClick={() => setLocation(ctaPath)}
              >
                {ctaLabel}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          ) : null}
          {children}
        </div>
        <div className="hidden shrink-0 lg:block" style={{ width: 300 }}>
          <div className="sticky top-6 space-y-4">
            {nextActionPanel}
            <GeoGrowthSuggestionsPanel
              projectId={selectedProjectId}
              suggestions={growthSuggestions.suggestions}
              loading={growthSuggestions.loading}
              variant="sidebar"
            />
          </div>
        </div>
      </div>

      {isMobile ? (
        <ProjectNextActionMobileDock summaryLabel={mobileDockSummary}>
          {nextActionPanel}
          <GeoGrowthSuggestionsPanel
            projectId={selectedProjectId}
            suggestions={growthSuggestions.suggestions}
            loading={growthSuggestions.loading}
            variant="sidebar"
          />
        </ProjectNextActionMobileDock>
      ) : null}
    </div>
  );
}
