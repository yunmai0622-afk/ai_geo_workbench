import {
  AiActionCard,
  AiGlassPanel,
  AiMetricCard,
  AiPageHero,
  AiPageShell,
  AiSection,
} from "@/components/ai/ProductUi";
import { BusinessPageProjectHeader } from "@/components/BusinessPageProjectHeader";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { checkLocalAgentHealth } from "@/lib/localAgentClient";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  WORKSPACE_PIPELINE_LABELS,
  WORKSPACE_STAGES,
  resolveWorkspaceStage,
  workspaceCtaUrl,
  type WorkspaceStageId,
} from "@shared/workspaceStateMachine";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const QUICK_LINKS = [
  { label: "GEO 建档", path: "/enterprise-profile" },
  { label: "内容生产", path: "/weekly" },
  { label: "发布中心", path: "/content-publishing" },
  { label: "收录监测", path: "/inclusion-monitoring" },
  { label: "交付报告", path: "/delivery-reports" },
] as const;

function pipelineIndexForStage(stageId: WorkspaceStageId): number {
  const map: Record<WorkspaceStageId, number> = {
    bind_publish_env: 0,
    complete_geo_profile: 0,
    ai_diagnosis: 1,
    generate_content: 2,
    publish_content: 3,
    retest_queue: 4,
    optimize: 5,
    delivery_report: 6,
  };
  return map[stageId] ?? 0;
}

export default function EnterpriseWorkspacePage() {
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectedProject, enabled, projectsLoading } = useActiveProjectSelection();
  const [localAgentOnline, setLocalAgentOnline] = useState<boolean | null>(null);

  const summaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );

  useEffect(() => {
    document.title = "企业工作台 - GEO 内容增长";
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
    return resolveWorkspaceStage({
      ...m,
      localAgentOnline,
    });
  }, [summaryQuery.data, selectedProjectId, localAgentOnline]);

  if (!enabled && !projectsLoading) {
    return (
      <div data-testid="workspace-page">
        <AiPageShell>
          <ProjectContextEmptyState testId="workspace-empty" />
        </AiPageShell>
      </div>
    );
  }

  const metrics = summaryQuery.data;
  const stage = resolution?.currentStage;
  const pipelineActive = stage ? pipelineIndexForStage(stage.id) : 0;

  return (
    <div data-testid="workspace-page">
    <AiPageShell>
      <AiPageHero
        title="企业工作台"
        description="查看当前企业的 GEO 建档、内容生产、发布、监测和报告进度。"
        badge="任务驾驶舱"
      >
        <BusinessPageProjectHeader projectName={selectedProject?.enterpriseName} testId="workspace-project-header" />
      </AiPageHero>

      {summaryQuery.isLoading ? (
        <p className="text-sm text-slate-400">加载工作台状态…</p>
      ) : summaryQuery.isError ? (
        <p className="text-sm text-amber-100">暂时无法加载工作台，请刷新重试。</p>
      ) : stage && metrics && selectedProjectId ? (
        <>
          <AiSection title="当前阶段">
            <AiGlassPanel className="space-y-4 p-5 md:p-6" data-testid="workspace-current-stage">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-cyan-200/90">当前阶段</p>
                  <h2 className="text-2xl font-semibold text-white">{stage.label}</h2>
                  <ul className="space-y-1 text-sm text-slate-300" data-testid="workspace-blocker-reasons">
                    {resolution.blockerReasons.map(line => (
                      <li key={line} className="flex gap-2">
                        <span className="text-amber-300/90">·</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  type="button"
                  className="shrink-0 bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                  data-testid="workspace-primary-cta"
                  onClick={() => setLocation(workspaceCtaUrl(selectedProjectId, stage))}
                >
                  {stage.ctaLabel}
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </AiGlassPanel>
          </AiSection>

          <AiSection title="进度总览" description="仅统计当前企业项目，不混合其它客户数据。">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="workspace-progress-metrics">
              <AiMetricCard label="建档完成度" value={`${metrics.profileCompletionPercent}%`} hint="基于企业 GEO 建档" accent="cyan" />
              <AiMetricCard label="绑定账号数" value={String(metrics.boundPublishAccountCount)} hint="可发布且会话有效" accent="violet" />
              <AiMetricCard label="内容资产数" value={String(metrics.articleCount)} hint="已生成文章" />
              <AiMetricCard label="已发布数" value={String(metrics.publishRecordCount)} hint="发布记录" accent="emerald" />
              <AiMetricCard label="待复测数" value={String(metrics.retestPendingCount)} hint="复测队列" accent="amber" />
              <AiMetricCard label="需重写数" value={String(metrics.rewriteOpenCount)} hint="重写池" />
              <AiMetricCard
                label="AI 实测数"
                value={metrics.aiTestResultCount > 0 ? String(metrics.aiTestResultCount) : "暂无"}
                hint={
                  metrics.brandMentionRate != null
                    ? `品牌提及率 ${Math.round(metrics.brandMentionRate * 100)}%`
                    : "来自收录监测"
                }
              />
              <AiMetricCard
                label="GEO 分数"
                value={metrics.geoScore != null ? `${metrics.geoScore} 分` : "暂无"}
                hint="最近一次内容诊断"
                accent="cyan"
              />
            </div>
          </AiSection>

          <AiSection title="主链路进度">
            <div data-testid="workspace-pipeline">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {WORKSPACE_PIPELINE_LABELS.map((label, index) => {
                const done = index < pipelineActive;
                const active = index === pipelineActive;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1.5 font-medium",
                        active
                          ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                          : done
                            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                            : "border-white/10 bg-white/[0.04] text-slate-500",
                      )}
                    >
                      {label}
                    </span>
                    {index < WORKSPACE_PIPELINE_LABELS.length - 1 ? (
                      <span className="text-slate-600" aria-hidden>
                        →
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            </div>
          </AiSection>

          <AiSection title="快捷入口">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {QUICK_LINKS.map(link => (
                <AiActionCard
                  key={link.path}
                  title={link.label}
                  description={`进入${link.label}`}
                  actionLabel="打开"
                  onAction={() => setLocation(buildProjectUrl(link.path, selectedProjectId))}
                />
              ))}
            </div>
          </AiSection>

          {resolution.riskHints.length > 0 ? (
            <AiSection title="风险提示">
              <AiGlassPanel className="border-amber-400/20 bg-amber-500/10 p-4" data-testid="workspace-risk-hints">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-200" />
                  <ul className="space-y-2 text-sm leading-relaxed text-amber-50/95">
                    {resolution.riskHints.map(hint => (
                      <li key={hint}>{hint}</li>
                    ))}
                  </ul>
                </div>
              </AiGlassPanel>
            </AiSection>
          ) : null}

          <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
            <summary className="cursor-pointer font-medium text-slate-300">各阶段说明（只读）</summary>
            <ul className="mt-3 space-y-2">
              {WORKSPACE_STAGES.map(s => (
                <li key={s.id}>
                  <span className="text-white">{s.label}</span>
                  <span className="text-slate-500"> — </span>
                  {s.blockerHint}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </AiPageShell>
    </div>
  );
}
