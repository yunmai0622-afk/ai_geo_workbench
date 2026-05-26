import { P0Card } from "@/components/geo/P0UiPrimitives";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand, geoTypography, stageBadgeClass } from "@/lib/geoP0Visual";
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
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const QUICK_LINKS = [
  { label: "GEO 建档", path: "/enterprise-profile", desc: "补齐企业被 AI 理解的基础信息" },
  { label: "AI 现状诊断", path: "/ai-diagnosis", desc: "检测品牌在 AI 平台中的提及与推荐" },
  { label: "平台化内容生产", path: "/weekly", desc: "按平台生成 GEO 内容任务" },
  { label: "发布中心", path: "/content-publishing", desc: "通过 Local Agent 执行发布" },
  { label: "收录监测", path: "/inclusion-monitoring", desc: "检查内容是否被识别" },
  { label: "交付报告", path: "/delivery-reports", desc: "生成客户可读报告" },
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

  const profileZero = metrics?.profileCompletionPercent === 0;

  // 确定主 CTA：如果 P0 建档未完成，优先引导去建档
  const primaryCtaLabel = useMemo(() => {
    if (!stage || !metrics) return null;
    if (!metrics.p0ProfileComplete && stage.id === "bind_publish_env") {
      return "继续完成 GEO 建档";
    }
    return stage.ctaLabel;
  }, [stage, metrics]);

  const primaryCtaUrl = useMemo(() => {
    if (!stage || !selectedProjectId) return null;
    if (!metrics?.p0ProfileComplete && stage.id === "bind_publish_env") {
      return buildProjectUrl("/enterprise-profile", selectedProjectId);
    }
    return workspaceCtaUrl(selectedProjectId, stage);
  }, [stage, selectedProjectId, metrics]);

  if (!enabled && !projectsLoading) {
    return (
      <div data-testid="workspace-page">
        <ProjectContextEmptyState testId="workspace-empty" />
      </div>
    );
  }

  return (
    <div className="space-y-7" data-testid="workspace-page">
      {/* 页面标题 */}
      <div className="space-y-1">
        <p className="text-[13px] font-medium text-gray-400">企业 GEO 增长驾驶舱</p>
        <h1 className={cn(geoTypography.pageTitle)} data-testid="workspace-enterprise-name">
          {selectedProject?.enterpriseName ?? "当前企业"}
        </h1>
      </div>

      {summaryQuery.isLoading ? (
        <p className="text-sm text-gray-400">加载驾驶舱数据…</p>
      ) : summaryQuery.isError ? (
        <p className="text-sm text-red-600">暂时无法加载驾驶舱，请刷新重试。</p>
      ) : profileZero && selectedProjectId ? (
        <P0Card testId="workspace-profile-zero" className="py-12 text-center">
          <p className="text-sm leading-relaxed text-gray-600">
            请先完成 5 分钟 GEO 建档，让系统了解您的企业。
          </p>
          <Button
            type="button"
            className={cn("mt-4 rounded-xl", geoP0Brand.primary)}
            onClick={() => setLocation(buildProjectUrl("/enterprise-profile", selectedProjectId))}
          >
            去建档
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </P0Card>
      ) : stage && metrics && selectedProjectId ? (
        <>
          {/* ═══ 企业增长状态总览区 ═══ */}
          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            {/* 左大卡：当前阶段 + 主 CTA */}
            <div className="geo-card space-y-4 bg-gradient-to-br from-blue-50/60 via-white to-white p-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">当前 GEO 阶段</p>
              <div className="flex flex-wrap items-center gap-3">
                {stageLabel ? <span className={stageBadgeClass(stageLabel)}>{stageLabel}</span> : null}
              </div>
              <div className="rounded-lg bg-white/80 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">AI 搜索可见度评分</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-gray-900">
                  {formatGeoScore(metrics.geoScore)}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-gray-600" data-testid="workspace-blocker-reasons">
                {resolution.blockerReasons[0] ?? stage.blockerHint}
              </p>
              {primaryCtaLabel && primaryCtaUrl ? (
                <Button
                  type="button"
                  className={cn("rounded-xl px-5", geoP0Brand.primary)}
                  data-testid="workspace-primary-cta"
                  onClick={() => setLocation(primaryCtaUrl)}
                >
                  {primaryCtaLabel}
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              ) : null}
            </div>

            {/* 右小卡：关键指标 */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <MiniMetric
                label="建档完成度"
                value={metrics.profileCompletionPercent > 0 ? `${metrics.profileCompletionPercent}%` : "--"}
              />
              <MiniMetric
                label="内容资产"
                value={metrics.articleCount > 0 ? `${metrics.articleCount} 篇` : "--"}
              />
              <MiniMetric
                label="发布记录"
                value={metrics.publishRecordCount > 0 ? `${metrics.publishRecordCount} 次` : "--"}
              />
              <MiniMetric
                label="AI 实测"
                value={
                  metrics.aiTestResultCount > 0
                    ? metrics.brandMentionRate != null
                      ? `提及率 ${Math.round(metrics.brandMentionRate * 100)}%`
                      : `${metrics.aiTestResultCount} 条`
                    : "--"
                }
              />
            </div>
          </div>

          {/* ═══ 主链路进度推进器 ═══ */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">GEO 主链路进度</h2>
            <div data-testid="workspace-pipeline" className="flex items-center gap-0 overflow-x-auto pb-1">
              {COCKPIT_PIPELINE_STEPS.map((label, index) => {
                const monitoringStep = index === 4;
                const done =
                  index < pipelineActive || (monitoringStep && monitoringActive && pipelineActive >= 3);
                const active =
                  index === pipelineActive ||
                  (monitoringStep && monitoringActive && pipelineActive >= 3 && index >= pipelineActive);
                return (
                  <div key={label} className="flex items-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all",
                          active
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-4 ring-blue-100"
                            : done
                              ? "bg-emerald-500 text-white"
                              : "border-2 border-gray-300 bg-white text-gray-400",
                        )}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                      </span>
                      <span
                        className={cn(
                          "whitespace-nowrap text-xs font-medium",
                          active ? "text-blue-700" : done ? "text-emerald-700" : "text-gray-400",
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    {index < COCKPIT_PIPELINE_STEPS.length - 1 ? (
                      <div
                        className={cn(
                          "mx-1 mb-5 h-0.5 w-8 rounded-full sm:w-12",
                          done ? "bg-emerald-300" : "bg-gray-200",
                        )}
                        aria-hidden
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ═══ 快捷入口 ═══ */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">下一步可进入的功能</h2>
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
                  <button
                    key={link.path}
                    type="button"
                    onClick={() => setLocation(buildProjectUrl(link.path, selectedProjectId))}
                    className={cn(
                      "geo-card flex flex-col items-start p-4 text-left transition-all",
                      highlight
                        ? "border-blue-300 bg-blue-50/80 ring-1 ring-blue-200"
                        : "hover:border-blue-200 hover:shadow-md",
                    )}
                  >
                    <span className="text-sm font-semibold text-gray-900">{link.label}</span>
                    <span className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-gray-500">{link.desc}</span>
                    <span className="mt-2 text-xs font-medium text-blue-600">打开 →</span>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

/* ─── 小指标卡片 ─── */
function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="geo-card px-4 py-3">
      <p className="text-[11px] font-medium text-gray-400">{label}</p>
      <p className="mt-0.5 text-base font-bold tabular-nums tracking-tight text-gray-900">{value}</p>
    </div>
  );
}
