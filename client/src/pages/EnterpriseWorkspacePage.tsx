import { P0Card } from "@/components/geo/P0UiPrimitives";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand, geoTypography, stageBadgeClass } from "@/lib/geoP0Visual";
import { checkLocalAgentHealth } from "@/lib/localAgentClient";
import {
  CUSTOMER_STAGE_LABELS,
  formatGeoScore,
} from "@/lib/projectWorkspaceDisplay";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { resolveWorkspaceStage, workspaceCtaUrl } from "@shared/workspaceStateMachine";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

/**
 * 8 步主链路定义（对齐用户规范）
 * 每步对应一个阶段卡片
 */
const EIGHT_STEP_PIPELINE = [
  {
    step: 1,
    name: "企业资料建档",
    desc: "补齐企业被 AI 理解的基础信息与品牌资产",
    path: "/enterprise-profile",
    stageIds: ["bind_publish_env", "complete_geo_profile"] as string[],
  },
  {
    step: 2,
    name: "AI 搜索现状实测",
    desc: "在多个 AI 平台中检测企业是否被提及和推荐",
    path: "/ai-diagnosis",
    stageIds: ["ai_diagnosis"] as string[],
  },
  {
    step: 3,
    name: "品牌资产补全",
    desc: "基于诊断结果补全差异化资料与可信证据",
    path: "/enterprise-profile",
    stageIds: [] as string[],
  },
  {
    step: 4,
    name: "内容资产生成",
    desc: "围绕 AI 引用逻辑生成品牌认知内容",
    path: "/weekly",
    stageIds: ["generate_content"] as string[],
  },
  {
    step: 5,
    name: "平台适配发布",
    desc: "将内容适配不同平台规则并执行发布",
    path: "/content-publishing",
    stageIds: ["publish_content"] as string[],
  },
  {
    step: 6,
    name: "收录与引用监测",
    desc: "检查内容是否被 AI 平台收录和引用",
    path: "/inclusion-monitoring",
    stageIds: ["retest_queue"] as string[],
  },
  {
    step: 7,
    name: "GEO 评分与竞品对比",
    desc: "评估品牌可见性变化与竞品差距",
    path: "/ai-diagnosis",
    stageIds: ["optimize"] as string[],
  },
  {
    step: 8,
    name: "交付报告与下一轮优化",
    desc: "生成客户可读报告，规划下一轮增长动作",
    path: "/delivery-reports",
    stageIds: ["delivery_report"] as string[],
  },
] as const;

function getActiveStepIndex(stageId: string): number {
  const idx = EIGHT_STEP_PIPELINE.findIndex(s => s.stageIds.includes(stageId));
  return idx >= 0 ? idx : 0;
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
    document.title = "项目工作台";
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
  const activeStepIdx = stage ? getActiveStepIndex(stage.id) : 0;

  if (!enabled && !projectsLoading) {
    return (
      <div data-testid="workspace-page">
        <ProjectContextEmptyState testId="workspace-empty" />
      </div>
    );
  }

  return (
    <div className="space-y-7" data-testid="workspace-page">
      {summaryQuery.isLoading ? (
        <p className="text-sm text-gray-400">加载工作台数据…</p>
      ) : summaryQuery.isError ? (
        <p className="text-sm text-red-600">暂时无法加载工作台，请刷新重试。</p>
      ) : stage && metrics && selectedProjectId ? (
        <>
          {/* ═══ 顶部指标区 ═══ */}
          <section className="geo-card p-6" data-testid="workspace-header-card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-gray-400">项目工作台</p>
                <h1 className={cn(geoTypography.pageTitle, "mt-0.5")} data-testid="workspace-enterprise-name">
                  {selectedProject?.enterpriseName ?? "当前企业"}
                </h1>
              </div>
              {stageLabel ? <span className={stageBadgeClass(stageLabel)}>{stageLabel}</span> : null}
            </div>

            {/* 指标行 */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              <MetricCell label="GEO 分" value={formatGeoScore(metrics.geoScore)} />
              <MetricCell
                label="品牌提及率"
                value={
                  metrics.brandMentionRate != null && metrics.aiTestResultCount > 0
                    ? `${Math.round(metrics.brandMentionRate * 100)}%`
                    : "--"
                }
              />
              <MetricCell label="推荐率" value="--" />
              <MetricCell
                label="最近实测"
                value={
                  metrics.aiTestResultCount > 0 ? `${metrics.aiTestResultCount} 条` : "暂无"
                }
              />
              <MetricCell
                label="内容资产"
                value={metrics.articleCount > 0 ? `${metrics.articleCount} 篇` : "--"}
              />
              <MetricCell
                label="发布记录"
                value={metrics.publishRecordCount > 0 ? `${metrics.publishRecordCount} 次` : "--"}
              />
            </div>

            {/* 风险 + 主 CTA */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              {resolution.riskHints.length > 0 ? (
                <div className="flex items-center gap-2 text-[13px] text-amber-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{resolution.riskHints[0]}</span>
                </div>
              ) : (
                <span className="text-[13px] text-gray-400">{resolution.blockerReasons[0]}</span>
              )}
              <Button
                type="button"
                className={cn("rounded-xl px-5", geoP0Brand.primary)}
                data-testid="workspace-primary-cta"
                onClick={() => setLocation(workspaceCtaUrl(selectedProjectId, stage))}
              >
                {stage.ctaLabel}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </section>

          {/* ═══ 8 步流程卡 ═══ */}
          <section className="space-y-4" data-testid="workspace-pipeline-section">
            <h2 className={geoTypography.sectionTitle}>增长主链路</h2>
            <p className="text-sm text-gray-500">
              客户一眼知道：我现在在哪一步，下一步该干什么，为什么做这个。
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {EIGHT_STEP_PIPELINE.map((step, idx) => {
                const isCurrent = idx === activeStepIdx;
                const isDone = idx < activeStepIdx;
                return (
                  <button
                    key={step.step}
                    type="button"
                    onClick={() => setLocation(buildProjectUrl(step.path, selectedProjectId))}
                    className={cn(
                      "geo-card flex flex-col items-start p-4 text-left transition-all",
                      isCurrent
                        ? "border-blue-300 bg-blue-50/80 ring-1 ring-blue-200 shadow-md"
                        : isDone
                          ? "border-emerald-200 bg-emerald-50/40"
                          : "hover:border-blue-200 hover:shadow-sm",
                    )}
                    data-testid={`pipeline-step-${step.step}`}
                  >
                    {/* 步骤编号 */}
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                          isCurrent
                            ? "bg-blue-600 text-white"
                            : isDone
                              ? "bg-emerald-500 text-white"
                              : "border border-gray-300 bg-white text-gray-400",
                        )}
                      >
                        {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.step}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          isCurrent ? "text-blue-800" : isDone ? "text-emerald-800" : "text-gray-700",
                        )}
                      >
                        {step.name}
                      </span>
                    </div>
                    {/* 说明 */}
                    <p className="line-clamp-2 text-[12px] leading-relaxed text-gray-500">{step.desc}</p>
                    {/* 状态 */}
                    <span
                      className={cn(
                        "mt-2 text-[11px] font-medium",
                        isCurrent ? "text-blue-600" : isDone ? "text-emerald-600" : "text-gray-400",
                      )}
                    >
                      {isCurrent ? "当前阶段 →" : isDone ? "已完成" : "待进入"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : metrics === undefined && selectedProjectId ? (
        <P0Card testId="workspace-profile-zero" className="py-12 text-center">
          <p className="text-sm leading-relaxed text-gray-600">
            请先完成品牌资料建档，让系统了解您的企业。
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
      ) : null}
    </div>
  );
}

/* ─── 小指标单元格 ─── */
function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-gray-400">{label}</p>
      <p className="mt-0.5 text-base font-bold tabular-nums tracking-tight text-gray-900">{value}</p>
    </div>
  );
}
