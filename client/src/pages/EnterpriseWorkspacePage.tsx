import { P0Card, P0MetricTile, P0QuickLinkCard, P0Section } from "@/components/geo/P0UiPrimitives";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand, stageBadgeClass } from "@/lib/geoP0Visual";
import { checkLocalAgentHealth } from "@/lib/localAgentClient";
import {
  COCKPIT_PIPELINE_STEPS,
  CUSTOMER_STAGE_LABELS,
  cockpitPipelineIndex,
  formatGeoScore,
} from "@/lib/projectWorkspaceDisplay";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { resolveWorkspaceStage, workspaceCtaUrl } from "@shared/workspaceStateMachine";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const QUICK_LINKS = [
  { label: "GEO 建档", path: "/enterprise-profile" },
  { label: "AI 现状诊断", path: "/ai-diagnosis" },
  { label: "平台化内容生产", path: "/weekly" },
  { label: "发布中心", path: "/content-publishing" },
  { label: "收录监测", path: "/inclusion-monitoring" },
  { label: "交付报告", path: "/delivery-reports" },
] as const;

export default function EnterpriseWorkspacePage() {
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectedProject, enabled, projectsLoading } = useActiveProjectSelection();
  const [localAgentOnline, setLocalAgentOnline] = useState<boolean | null>(null);

  const summaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );

  useEffect(() => {
    document.title = "企业 GEO 增长驾驶舱";
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const health = await checkLocalAgentHealth();
      if (!cancelled) setLocalAgentOnline(health?.ok ?? false);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, selectedProjectId]);

  const resolution = useMemo(() => {
    const m = summaryQuery.data;
    if (!m || !selectedProjectId) return null;
    return resolveWorkspaceStage({ ...m, localAgentOnline });
  }, [summaryQuery.data, selectedProjectId, localAgentOnline]);

  const metrics = summaryQuery.data;
  const stage = resolution?.currentStage;
  const stageLabel = stage ? CUSTOMER_STAGE_LABELS[stage.id] : null;
  const pipelineActive = stage ? cockpitPipelineIndex(stage.id) : 0;
  const monitoringActive =
    Boolean(metrics && metrics.monitoringRecordCount > 0 && pipelineActive >= 3);

  const metricCards = useMemo(() => {
    if (!metrics) return [];
    const cards: { label: string; value: string; hint?: string }[] = [];
    if (metrics.profileCompletionPercent > 0) {
      cards.push({ label: "建档完成度", value: `${metrics.profileCompletionPercent}%`, hint: "基于 GEO 建档" });
    }
    if (metrics.articleCount > 0) {
      cards.push({ label: "内容资产", value: `${metrics.articleCount} 篇` });
    }
    if (metrics.publishRecordCount > 0) {
      cards.push({ label: "已发布", value: `${metrics.publishRecordCount} 次` });
    }
    if (metrics.retestPendingCount > 0) {
      cards.push({ label: "待复测", value: `${metrics.retestPendingCount} 条` });
    }
    if (metrics.aiTestResultCount > 0) {
      cards.push({
        label: "AI 实测",
        value: String(metrics.aiTestResultCount),
        hint:
          metrics.brandMentionRate != null
            ? `品牌提及率 ${Math.round(metrics.brandMentionRate * 100)}%`
            : undefined,
      });
    }
    if (metrics.geoScore != null) {
      cards.push({ label: "GEO 评分", value: `${metrics.geoScore} 分` });
    }
    return cards;
  }, [metrics]);

  const profileZero = metrics?.profileCompletionPercent === 0;

  if (!enabled && !projectsLoading) {
    return (
      <div data-testid="workspace-page">
        <ProjectContextEmptyState testId="workspace-empty" />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="workspace-page">
      <div className="space-y-1">
        <p className="text-sm text-slate-500">企业 GEO 增长驾驶舱</p>
        <h1 className="text-2xl font-bold text-slate-900" data-testid="workspace-enterprise-name">
          {selectedProject?.enterpriseName ?? "当前企业"}
        </h1>
      </div>

      {summaryQuery.isLoading ? (
        <p className="text-sm text-slate-500">加载驾驶舱数据…</p>
      ) : summaryQuery.isError ? (
        <p className="text-sm text-red-600">暂时无法加载驾驶舱，请刷新重试。</p>
      ) : profileZero && selectedProjectId ? (
        <P0Card testId="workspace-profile-zero" className="text-center">
          <p className="text-sm leading-relaxed text-slate-700">
            请先完成 5 分钟 GEO 建档，让系统了解您的企业。
          </p>
          <Button
            type="button"
            className={cn("mt-4", geoP0Brand.primary)}
            onClick={() => setLocation(buildProjectUrl("/enterprise-profile", selectedProjectId))}
          >
            去建档
          </Button>
        </P0Card>
      ) : stage && metrics && selectedProjectId ? (
        <>
          <P0Card
            testId="workspace-current-stage"
            className="bg-gradient-to-r from-blue-50/80 to-white space-y-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">当前 GEO 阶段</p>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {stageLabel ? <span className={stageBadgeClass(stageLabel)}>{stageLabel}</span> : null}
                  <span className="text-3xl font-bold tabular-nums text-slate-900">
                    GEO {formatGeoScore(metrics.geoScore)}
                  </span>
                </div>
                <p className="text-sm text-slate-700" data-testid="workspace-blocker-reasons">
                  {resolution.blockerReasons[0] ?? stage.blockerHint}
                </p>
              </div>
              <Button
                type="button"
                className={geoP0Brand.primary}
                data-testid="workspace-primary-cta"
                onClick={() => setLocation(workspaceCtaUrl(selectedProjectId, stage))}
              >
                {stage.ctaLabel}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </P0Card>

          <P0Section title="GEO 主链路进度">
            <div data-testid="workspace-pipeline" className="flex flex-wrap items-center gap-1">
              {COCKPIT_PIPELINE_STEPS.map((label, index) => {
                const monitoringStep = index === 4;
                const done =
                  index < pipelineActive || (monitoringStep && monitoringActive && pipelineActive >= 3);
                const active =
                  index === pipelineActive ||
                  (monitoringStep && monitoringActive && pipelineActive >= 3 && index >= pipelineActive);
                return (
                  <div key={label} className="flex items-center gap-1">
                    <div className="flex flex-col items-center gap-1.5 px-1">
                      <span
                        className={cn(
                          "flex h-3 w-3 rounded-full border-2",
                          active
                            ? "border-blue-600 bg-blue-600 ring-4 ring-blue-100"
                            : done
                              ? "border-emerald-500 bg-emerald-500"
                              : "border-slate-300 bg-white",
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs font-medium",
                          active ? "text-blue-700" : done ? "text-emerald-700" : "text-slate-400",
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    {index < COCKPIT_PIPELINE_STEPS.length - 1 ? (
                      <div
                        className={cn("mb-4 h-0.5 w-6 sm:w-10", done ? "bg-emerald-300" : "bg-slate-200")}
                        aria-hidden
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </P0Section>

          {metricCards.length > 0 ? (
            <P0Section title="关键指标" description="仅展示当前企业的真实数据。">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="workspace-progress-metrics">
                {metricCards.map(card => (
                  <P0MetricTile key={card.label} label={card.label} value={card.value} hint={card.hint} />
                ))}
              </div>
            </P0Section>
          ) : (
            <p className="text-sm text-slate-500" data-testid="workspace-metrics-empty">
              暂无数据，完成对应步骤后展示
            </p>
          )}

          <P0Section title="快捷入口">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_LINKS.map(link => {
                const highlight =
                  (link.path === "/enterprise-profile" &&
                    (stage.id === "complete_geo_profile" || stage.id === "bind_publish_env")) ||
                  (link.path === "/ai-diagnosis" && stage.id === "ai_diagnosis") ||
                  (link.path === "/weekly" && stage.id === "generate_content") ||
                  (link.path === "/content-publishing" &&
                    (stage.id === "publish_content" || stage.id === "retest_queue")) ||
                  (link.path === "/inclusion-monitoring" && monitoringActive) ||
                  (link.path === "/delivery-reports" && stage.id === "delivery_report");
                return (
                  <P0QuickLinkCard
                    key={link.path}
                    title={link.label}
                    active={highlight}
                    onClick={() => setLocation(buildProjectUrl(link.path, selectedProjectId))}
                  />
                );
              })}
            </div>
          </P0Section>
        </>
      ) : null}
    </div>
  );
}
