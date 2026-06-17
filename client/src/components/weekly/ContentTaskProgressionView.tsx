import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import type {
  ContentOptimizationTaskView,
  RecommendedPlatformView,
} from "@shared/contentOptimizationTaskView";
import {
  MONTHLY_PLAN_UNBOUND_HINT,
  WEEKLY_CONTENT_TASK_VIEW_FALLBACK_MESSAGE,
} from "@shared/contentOptimizationTaskView";
import { cn } from "@/lib/utils";
import { ArrowRight, Calendar, Target, AlertTriangle, Layers, Zap } from "lucide-react";

/** Map dimension keys to human-readable labels */
const DIMENSION_LABEL_MAP: Record<string, string> = {
  brandIdentity: "提升品牌实体清晰度",
  categoryPositioning: "提升品类定位清晰度",
  questionCoverage: "提升搜索问题覆盖度",
  sourceGraph: "提升公开信源完整度",
  trustEvidence: "提升信任证据强度",
  aiTestPerformance: "提升 AI 实测表现",
};
function humanizeTarget(raw: string): string {
  return DIMENSION_LABEL_MAP[raw] ?? raw;
}

/* ─────────────────────────────────────────────────────────────────────────────
   First Screen: Task Context Hero
   ───────────────────────────────────────────────────────────────────────────── */

type FirstScreenProps = {
  view: ContentOptimizationTaskView;
  onNextStep: () => void;
  onGoMonthlyPlan?: () => void;
};

export function TaskContextHero({ view, onNextStep, onGoMonthlyPlan }: FirstScreenProps) {
  return (
    <section className="space-y-5" data-testid="task-progression-hero">
      {/* 当前优化问题 */}
      <P0Card testId="task-hero-question" className="border-blue-100 bg-gradient-to-br from-blue-50/80 to-white">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100">
            <Target className="h-5 w-5 text-blue-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">当前优化问题</p>
            <h2
              className="mt-1 text-lg font-bold leading-snug text-gray-900"
              data-testid="task-hero-question-text"
            >
              {view.questionText}
            </h2>
          </div>
        </div>
      </P0Card>

      {/* 核心信息网格 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 为什么要优化 */}
        <InfoCard
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          label="为什么要优化"
          value={view.taskReason}
          testId="task-hero-reason"
        />

        {/* 对应成熟度短板 */}
        <InfoCard
          icon={<Layers className="h-4 w-4 text-red-500" />}
          label="对应成熟度短板"
          value={
            view.relatedGap
              ? `${view.relatedMaturityDimension}：${view.relatedGap}`
              : view.relatedMaturityDimension
          }
          testId="task-hero-gap"
        />

        {/* 所属本月计划 */}
        <InfoCard
          icon={<Calendar className="h-4 w-4 text-indigo-500" />}
          label="所属本月计划"
          value={view.monthlyPlanTitle ?? MONTHLY_PLAN_UNBOUND_HINT}
          hint={
            !view.monthlyPlanId
              ? view.monthlyPlanHint
              : view.monthlyPlanActionLabel ?? undefined
          }
          testId="task-hero-monthly-plan"
          action={
            !view.monthlyPlanId && onGoMonthlyPlan
              ? { label: "去本月优化计划", onClick: onGoMonthlyPlan }
              : undefined
          }
        />

        {/* 本次目标 */}
        <InfoCard
          icon={<Zap className="h-4 w-4 text-emerald-500" />}
          label="本次目标"
          value={humanizeTarget(view.targetImprovement)}
          testId="task-hero-target"
        />

        {/* 推荐平台 */}
        <div
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-1"
          data-testid="task-hero-platforms"
        >
          <p className="text-xs font-semibold text-gray-500">推荐平台</p>
          <ul className="mt-2 space-y-1.5">
            {view.recommendedPlatforms.map(p => (
              <li key={p.platformKey} className="flex items-baseline gap-1.5 text-sm">
                <span className="font-medium text-gray-900">{p.platformLabel}</span>
                <span className="text-xs text-gray-500">— {p.reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 复测计划 */}
        <InfoCard
          icon={<Calendar className="h-4 w-4 text-sky-500" />}
          label="复测计划"
          value={view.retestPlan.summary}
          testId="task-hero-retest"
        />
      </div>

      {/* 下一步按钮 */}
      <div className="flex justify-end">
        <Button
          type="button"
          className={cn(geoP0Brand.primary, "gap-1.5")}
          data-testid="task-hero-next-step-btn"
          onClick={onNextStep}
        >
          下一步
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Fallback: No question bound
   ───────────────────────────────────────────────────────────────────────────── */

type FallbackProps = {
  onGoMonthlyPlan?: () => void;
};

export function TaskProgressionFallback({ onGoMonthlyPlan }: FallbackProps) {
  return (
    <P0Card testId="task-progression-fallback">
      <p className={geoP0Surfaces.sectionTitle}>内容任务推进</p>
      <p
        className="mt-3 text-sm leading-relaxed text-gray-700"
        data-testid="task-progression-fallback-message"
      >
        {WEEKLY_CONTENT_TASK_VIEW_FALLBACK_MESSAGE}
      </p>
      {onGoMonthlyPlan ? (
        <Button
          type="button"
          size="sm"
          className={`mt-4 ${geoP0Brand.primary}`}
          data-testid="task-progression-go-monthly-plan"
          onClick={onGoMonthlyPlan}
        >
          去本月优化计划
        </Button>
      ) : null}
    </P0Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Mother Article Summary Card
   ───────────────────────────────────────────────────────────────────────────── */

type MotherArticleSummaryProps = {
  title: string | null;
  summary: string | null;
  corePoints?: string | null;
  status: string | null;
  onViewFull: () => void;
  onEdit: () => void;
  onApprove: () => void;
  approveDisabled?: boolean;
};

export function MotherArticleSummaryCard({
  title,
  summary,
  corePoints,
  status,
  onViewFull,
  onEdit,
  onApprove,
  approveDisabled,
}: MotherArticleSummaryProps) {
  if (!title) return null;

  return (
    <section className="space-y-3" data-testid="task-mother-article-summary">
      <div className="space-y-1">
        <h2 className={geoP0Surfaces.sectionTitle}>内容母稿</h2>
        <p className={geoP0Surfaces.muted}>默认展示摘要，需要时可查看全文或编辑。</p>
      </div>
      <P0Card testId="mother-article-card">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-900" data-testid="mother-article-title">
              {title}
            </h3>
            {status ? (
              <span
                className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-700"
                data-testid="mother-article-status"
              >
                {status}
              </span>
            ) : null}
          </div>

          {summary ? (
            <div>
              <p className="text-xs font-medium text-gray-500">摘要</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-700" data-testid="mother-article-summary">
                {summary}
              </p>
            </div>
          ) : null}

          {corePoints ? (
            <div>
              <p className="text-xs font-medium text-gray-500">核心观点</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-700" data-testid="mother-article-core-points">
                {corePoints}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={geoP0Brand.primaryOutline}
              data-testid="mother-article-view-full"
              onClick={onViewFull}
            >
              查看全文
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={geoP0Brand.primaryOutline}
              data-testid="mother-article-edit"
              onClick={onEdit}
            >
              编辑内容
            </Button>
            <Button
              type="button"
              size="sm"
              className={geoP0Brand.primary}
              data-testid="mother-article-approve"
              disabled={approveDisabled}
              onClick={onApprove}
            >
              审核通过
            </Button>
          </div>
        </div>
      </P0Card>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Platform Publish Plan (sorted by recommended)
   ───────────────────────────────────────────────────────────────────────────── */

import type { PlatformBoardRow } from "@/components/weekly/PlatformContentBoard";
import {
  WEEKLY_CONTENT_TASK_STATUS_BADGE_CLASS,
  weeklyContentTaskStatusLabel,
} from "@shared/weeklyContentTaskStatus";

type PlatformPlanProps = {
  rows: PlatformBoardRow[];
  recommendedPlatforms: RecommendedPlatformView[];
  boardBusy?: boolean;
  generatingPlatformKey?: string | null;
  onGenerate: (key: string) => void;
  onSaveAndQc: (key: string) => void;
  onEnqueue: (key: string) => void;
  onView: (key: string) => void;
};

export function PlatformPublishPlan({
  rows,
  recommendedPlatforms,
  boardBusy = false,
  generatingPlatformKey = null,
  onGenerate,
  onSaveAndQc,
  onEnqueue,
  onView,
}: PlatformPlanProps) {
  // Sort rows by recommended platform priority
  const recommendedOrder = new Map(recommendedPlatforms.map((p, i) => [p.platformKey, i]));
  const reasonMap = new Map(recommendedPlatforms.map(p => [p.platformKey, p.reason]));

  const sortedRows = [...rows].sort((a, b) => {
    const aOrder = recommendedOrder.get(a.def.key) ?? 999;
    const bOrder = recommendedOrder.get(b.def.key) ?? 999;
    return aOrder - bOrder;
  });

  const handlePrimary = (row: PlatformBoardRow) => {
    switch (row.primaryActionKind) {
      case "generate_platform_draft":
        onGenerate(row.def.key);
        break;
      case "save_and_qc":
        onSaveAndQc(row.def.key);
        break;
      case "enqueue_publish":
        onEnqueue(row.def.key);
        break;
    }
  };

  const PRIMARY_ACTION_LABEL = {
    generate_platform_draft: "生成平台稿",
    save_and_qc: "保存并质检",
    enqueue_publish: "加入发布队列",
  } as const;

  return (
    <section className="space-y-4" data-testid="task-platform-publish-plan">
      <div className="space-y-1">
        <h2 className={geoP0Surfaces.sectionTitle}>平台发布计划</h2>
        <p className={geoP0Surfaces.muted}>按推荐优先级排序，逐平台推进内容生成与发布。</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="task-platform-plan-grid">
        {sortedRows.map(row => {
          const { def, status, platformDraftStatusLabel, qualityScoreLabel, accountStatusLabel, primaryActionKind, hasContent } = row;
          const reason = reasonMap.get(def.key);
          const statusLabel = weeklyContentTaskStatusLabel(status);
          const isGenerating = status === "GENERATING" || generatingPlatformKey === def.key;
          const primaryLabel = PRIMARY_ACTION_LABEL[primaryActionKind];

          return (
            <P0Card key={def.key} testId={`task-platform-card-${def.key}`} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-900">{def.label}</h3>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    WEEKLY_CONTENT_TASK_STATUS_BADGE_CLASS[status],
                  )}
                >
                  {statusLabel}
                </span>
              </div>

              {reason ? (
                <p className="mt-1.5 text-xs text-blue-700" data-testid={`task-platform-reason-${def.key}`}>
                  推荐原因：{reason}
                </p>
              ) : null}

              <dl className="mt-3 space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between gap-2">
                  <dt>平台稿状态</dt>
                  <dd className="font-medium text-gray-800">{platformDraftStatusLabel}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>质检状态</dt>
                  <dd className="text-gray-800">{qualityScoreLabel}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>账号状态</dt>
                  <dd className="font-medium text-gray-800">{accountStatusLabel}</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-3">
                <Button
                  type="button"
                  size="sm"
                  className={geoP0Brand.primary}
                  disabled={boardBusy || isGenerating}
                  data-testid={`task-platform-action-${def.key}`}
                  onClick={() => handlePrimary(row)}
                >
                  {isGenerating && primaryActionKind === "generate_platform_draft" ? "生成中…" : `下一步：${primaryLabel}`}
                </Button>
                {hasContent ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={geoP0Brand.primaryOutline}
                    disabled={boardBusy}
                    onClick={() => onView(def.key)}
                  >
                    查看内容
                  </Button>
                ) : null}
              </div>
            </P0Card>
          );
        })}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Next Step Sidebar Card
   ───────────────────────────────────────────────────────────────────────────── */

type NextStepCardProps = {
  what: string;
  why: string;
  after: string;
  actionLabel: string;
  onAction: () => void;
};

export function NextStepSideCard({ what, why, after, actionLabel, onAction }: NextStepCardProps) {
  return (
    <aside className="w-full" data-testid="task-next-step-card">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">下一步</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div data-testid="task-next-what">
            <dt className="text-xs font-semibold text-gray-500">当前应该做什么</dt>
            <dd className="mt-0.5 text-gray-800">{what}</dd>
          </div>
          <div data-testid="task-next-why">
            <dt className="text-xs font-semibold text-gray-500">为什么做</dt>
            <dd className="mt-0.5 text-gray-800">{why}</dd>
          </div>
          <div data-testid="task-next-after">
            <dt className="text-xs font-semibold text-gray-500">做完去哪</dt>
            <dd className="mt-0.5 text-gray-800">{after}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <Button
            size="sm"
            className={geoP0Brand.primary}
            data-testid="task-next-action-btn"
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </aside>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Helper: InfoCard
   ───────────────────────────────────────────────────────────────────────────── */

function InfoCard({
  icon,
  label,
  value,
  hint,
  testId,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  testId: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      data-testid={testId}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-xs font-semibold text-gray-500">{label}</p>
      </div>
      <p className="mt-2 text-sm font-medium leading-relaxed text-gray-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      {action ? (
        <Button
          type="button"
          size="sm"
          variant="link"
          className="mt-2 h-auto p-0 text-xs text-blue-700"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
