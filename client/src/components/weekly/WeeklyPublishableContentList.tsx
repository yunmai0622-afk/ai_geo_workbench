import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import type { WeeklyArticleCardModel } from "@/components/weekly/WeeklyPlatformArticleCard";
import {
  resolveWeeklyEnqueueButtonKind,
  type WeeklyAccountDisplayStatus,
  type WeeklyAiQcDisplayStatus,
  type WeeklyCoverDisplayStatus,
  type WeeklyManualReviewDisplayStatus,
  type WeeklyPublishDisplayStatus,
  weeklyEnqueueButtonLabel,
} from "@shared/weeklyPublishableDisplay";
import { contentReviewStatusBadgeClass } from "@shared/contentReviewStatus";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

export type WeeklyPublishableRow = WeeklyArticleCardModel & {
  aiQcStatus: WeeklyAiQcDisplayStatus;
  manualReviewStatus: WeeklyManualReviewDisplayStatus;
  coverStatus: WeeklyCoverDisplayStatus;
  accountStatus: WeeklyAccountDisplayStatus;
  publishStatus: WeeklyPublishDisplayStatus;
  queueFailed?: boolean;
};

export type WeeklyPendingContentTab = "pending_review" | "enqueue_ready" | "queued" | "needs_modify";

const TAB_DEFS: Array<{ key: WeeklyPendingContentTab; label: string; testId: string }> = [
  { key: "pending_review", label: "待审核", testId: "weekly-tab-pending-review" },
  { key: "enqueue_ready", label: "可入队", testId: "weekly-tab-enqueue-ready" },
  { key: "queued", label: "已入队", testId: "weekly-tab-queued" },
  { key: "needs_modify", label: "需修改", testId: "weekly-tab-needs-modify" },
];

export function classifyWeeklyPendingContentTab(row: WeeklyPublishableRow): WeeklyPendingContentTab | null {
  if (row.aiQcStatus === "未通过" || row.aiQcStatus === "未质检") return "needs_modify";
  if (row.queueFailed) return "needs_modify";
  if (row.queuedForPublish || row.publishStatus === "已入队") return "queued";
  if (row.manualReviewStatus === "未审核" && row.aiQcStatus === "通过") return "pending_review";
  if (
    row.manualReviewStatus === "已审核" &&
    !row.queuedForPublish &&
    row.publishPreflightReady &&
    row.publishStatus !== "已发布"
  ) {
    return "enqueue_ready";
  }
  return null;
}

type Props = {
  rows: WeeklyPublishableRow[];
  disabled?: boolean;
  initialTab?: WeeklyPendingContentTab;
  onView: (model: WeeklyArticleCardModel) => void;
  onReviewConfirm: (model: WeeklyArticleCardModel) => void;
  onEnqueuePublish: (model: WeeklyArticleCardModel) => void;
  onGoPublishingPage?: () => void;
  onEdit?: (model: WeeklyArticleCardModel) => void;
};

function statusBadgeClass(value: string, tone: "neutral" | "ok" | "warn" | "bad"): string {
  const base = "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold";
  switch (tone) {
    case "ok":
      return cn(base, "bg-emerald-100 text-emerald-800");
    case "warn":
      return cn(base, "bg-amber-100 text-amber-800");
    case "bad":
      return cn(base, "bg-red-100 text-red-800");
    default:
      return cn(base, "bg-gray-100 text-gray-700");
  }
}

function resolveSourceLabel(row: WeeklyPublishableRow): string {
  return row.contentTypeLabel?.trim() || "内容任务";
}

function resolveStatusSummary(row: WeeklyPublishableRow): string {
  const parts = [row.aiQcStatus, row.manualReviewStatus, row.publishStatus].filter(Boolean);
  return parts.join(" · ");
}

function PendingContentCard({
  row,
  disabled,
  onView,
  onReviewConfirm,
  onEnqueuePublish,
  onGoPublishingPage,
  onEdit,
}: {
  row: WeeklyPublishableRow;
  disabled?: boolean;
  onView: (model: WeeklyArticleCardModel) => void;
  onReviewConfirm: (model: WeeklyArticleCardModel) => void;
  onEnqueuePublish: (model: WeeklyArticleCardModel) => void;
  onGoPublishingPage?: () => void;
  onEdit?: (model: WeeklyArticleCardModel) => void;
}) {
  const manualPending = row.manualReviewStatus === "未审核";
  const buttonKind = resolveWeeklyEnqueueButtonKind({
    published: row.publishStatus === "已发布",
    queued: row.queuedForPublish,
    queueFailed: row.queueFailed,
    aiQcStatus: row.aiQcStatus,
    manualReviewPending: manualPending,
    publishPreflightReady: row.publishPreflightReady,
  });
  const enqueueLabel = weeklyEnqueueButtonLabel(buttonKind);
  const enqueueDisabled =
    disabled ||
    buttonKind === "blocked_qc" ||
    buttonKind === "queued" ||
    buttonKind === "published" ||
    buttonKind === "failed";
  const qcFailed = row.aiQcStatus === "未通过" || row.aiQcStatus === "未质检";

  let primaryLabel: string | null = null;
  let primaryAction: (() => void) | null = null;
  let primaryDisabled = disabled;

  if (manualPending && row.aiQcStatus === "通过") {
    primaryLabel = "审核内容";
    primaryAction = () => onReviewConfirm(row);
  } else if (!manualPending && buttonKind === "enqueue") {
    primaryLabel = "加入发布队列";
    primaryAction = () => onEnqueuePublish(row);
    primaryDisabled = enqueueDisabled;
  } else if (buttonKind === "queued") {
    primaryLabel = "查看发布任务";
    primaryAction = onGoPublishingPage ?? null;
  } else if (buttonKind === "failed") {
    primaryLabel = "查看失败原因";
    primaryAction = () => onView(row);
  } else if (qcFailed) {
    primaryLabel = "查看并修改";
    primaryAction = () => (onEdit ? onEdit(row) : onView(row));
  }

  return (
    <P0Card testId={`weekly-publishable-card-${row.id}`} className="flex flex-col gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-gray-900">{row.title}</h3>
        <dl className="mt-2 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-gray-500">来源</dt>
            <dd data-testid={`weekly-publishable-source-${row.id}`}>{resolveSourceLabel(row)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">目标平台</dt>
            <dd data-testid={`weekly-publishable-platform-${row.id}`}>{row.targetPlatform ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-gray-500">当前状态</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={statusBadgeClass(
                  row.aiQcStatus,
                  row.aiQcStatus === "通过" ? "ok" : row.aiQcStatus === "未通过" ? "bad" : "warn",
                )}
                data-testid={`weekly-publishable-ai-qc-${row.id}`}
              >
                AI质检 {row.aiQcStatus}
              </span>
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                  contentReviewStatusBadgeClass(
                    row.manualReviewStatus === "已审核" ? "已审核可发布" : "待审核",
                  ),
                )}
                data-testid={`weekly-publishable-manual-review-${row.id}`}
              >
                人工审核 {row.manualReviewStatus}
              </span>
              <span
                className="text-xs text-gray-600"
                data-testid={`weekly-publishable-publish-status-${row.id}`}
              >
                {row.publishStatus}
              </span>
            </dd>
          </div>
        </dl>
        <p className="sr-only">{resolveStatusSummary(row)}</p>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        {primaryLabel && primaryAction ? (
          <Button
            type="button"
            size="sm"
            className={geoP0Brand.primary}
            disabled={primaryDisabled}
            data-testid={`weekly-publishable-primary-${row.id}`}
            onClick={primaryAction}
          >
            {primaryLabel}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={geoP0Brand.primaryOutline}
          data-testid={`weekly-publishable-view-${row.id}`}
          onClick={() => onView(row)}
        >
          查看详情
        </Button>
        {manualPending && row.aiQcStatus === "通过" && buttonKind !== "blocked_qc" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            disabled={enqueueDisabled}
            data-testid={`weekly-publishable-enqueue-${row.id}`}
            onClick={() => onEnqueuePublish(row)}
          >
            {enqueueLabel}
          </Button>
        ) : null}
      </div>
    </P0Card>
  );
}

export function WeeklyPublishableContentList({
  rows,
  disabled,
  initialTab = "pending_review",
  onView,
  onReviewConfirm,
  onEnqueuePublish,
  onGoPublishingPage,
  onEdit,
}: Props) {
  const [activeTab, setActiveTab] = useState<WeeklyPendingContentTab>(initialTab);

  const tabCounts = useMemo(() => {
    const counts: Record<WeeklyPendingContentTab, number> = {
      pending_review: 0,
      enqueue_ready: 0,
      queued: 0,
      needs_modify: 0,
    };
    for (const row of rows) {
      const tab = classifyWeeklyPendingContentTab(row);
      if (tab) counts[tab] += 1;
    }
    return counts;
  }, [rows]);

  const filteredRows = useMemo(
    () => rows.filter(row => classifyWeeklyPendingContentTab(row) === activeTab),
    [rows, activeTab],
  );

  const emptyMessages: Record<WeeklyPendingContentTab, { title: string; hint: string }> = {
    pending_review: {
      title: "暂无待审核内容",
      hint: "通过 AI 质检的内容将出现在此，请完成人工审核。",
    },
    enqueue_ready: {
      title: "暂无可入队内容",
      hint: "完成人工审核且发布检查通过的内容可加入发布队列。",
    },
    queued: {
      title: "暂无已入队内容",
      hint: "加入发布队列后的内容将在此展示，可前往发布执行中心跟进。",
    },
    needs_modify: {
      title: "暂无需修改内容",
      hint: "AI 质检未通过或需重写的内容将出现在此。",
    },
  };

  return (
    <section
      id="weekly-section-publishable-content"
      className="scroll-mt-24 space-y-4"
      data-testid="weekly-publishable-content-list"
    >
      <div className="space-y-1">
        <h2 className={geoP0Surfaces.sectionTitle}>待处理内容</h2>
        <p className={geoP0Surfaces.muted}>按审核与入队状态处理内容，完成质检与人工审核后加入发布队列。</p>
      </div>

      <div
        className="flex flex-wrap gap-2 border-b border-gray-200 pb-2"
        role="tablist"
        data-testid="weekly-pending-content-tabs"
      >
        {TAB_DEFS.map(tab => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200",
            )}
            data-testid={tab.testId}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tabCounts[tab.key] > 0 ? `（${tabCounts[tab.key]}）` : ""}
          </button>
        ))}
      </div>

      {filteredRows.length === 0 ? (
        <P0Card testId={`weekly-publishable-empty-${activeTab}`}>
          <p className="text-sm font-medium text-gray-800">{emptyMessages[activeTab].title}</p>
          <p className="mt-1 text-sm text-gray-600">{emptyMessages[activeTab].hint}</p>
        </P0Card>
      ) : (
        <div className="grid gap-4" data-testid="weekly-publishable-card-list">
          {filteredRows.map(row => (
            <PendingContentCard
              key={row.id}
              row={row}
              disabled={disabled}
              onView={onView}
              onReviewConfirm={onReviewConfirm}
              onEnqueuePublish={onEnqueuePublish}
              onGoPublishingPage={onGoPublishingPage}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </section>
  );
}
