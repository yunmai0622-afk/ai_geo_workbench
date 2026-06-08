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
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500">
              <tr>
                <th className="px-4 py-3">平台</th>
                <th className="px-4 py-3">标题</th>
                <th className="px-4 py-3">AI质检</th>
                <th className="px-4 py-3">人工审核</th>
                <th className="px-4 py-3">封面</th>
                <th className="px-4 py-3">账号</th>
                <th className="px-4 py-3">发布状态</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map(row => {
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

                return (
                  <tr key={row.id} data-testid={`weekly-publishable-row-${row.id}`}>
                    <td className="px-4 py-3 text-gray-800">{row.targetPlatform ?? "—"}</td>
                    <td className="max-w-[12rem] truncate px-4 py-3 font-medium text-gray-900">
                      {row.title}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={statusBadgeClass(
                          row.aiQcStatus,
                          row.aiQcStatus === "通过" ? "ok" : row.aiQcStatus === "未通过" ? "bad" : "warn",
                        )}
                        data-testid={`weekly-publishable-ai-qc-${row.id}`}
                      >
                        {row.aiQcStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                          contentReviewStatusBadgeClass(
                            row.manualReviewStatus === "已审核" ? "已审核可发布" : "待审核",
                          ),
                        )}
                        data-testid={`weekly-publishable-manual-review-${row.id}`}
                      >
                        {row.manualReviewStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.coverStatus}</td>
                    <td className="px-4 py-3 text-gray-700">{row.accountStatus}</td>
                    <td
                      className="px-4 py-3 text-gray-700"
                      data-testid={`weekly-publishable-publish-status-${row.id}`}
                    >
                      {row.publishStatus}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={geoP0Brand.primaryOutline}
                          data-testid={`weekly-publishable-view-${row.id}`}
                          onClick={() => onView(row)}
                        >
                          查看
                        </Button>
                        {qcFailed ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={geoP0Brand.primaryOutline}
                            data-testid={`weekly-publishable-edit-${row.id}`}
                            onClick={() => (onEdit ? onEdit(row) : onView(row))}
                          >
                            查看并修改
                          </Button>
                        ) : null}
                        {manualPending && row.aiQcStatus === "通过" ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={geoP0Brand.primaryOutline}
                              disabled={disabled}
                              data-testid={`weekly-publishable-review-${row.id}`}
                              onClick={() => onReviewConfirm(row)}
                            >
                              审核内容
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className={geoP0Brand.primary}
                              disabled={enqueueDisabled}
                              data-testid={`weekly-publishable-enqueue-${row.id}`}
                              onClick={() => onEnqueuePublish(row)}
                            >
                              {enqueueLabel}
                            </Button>
                          </>
                        ) : null}
                        {!manualPending && buttonKind === "enqueue" ? (
                          <Button
                            type="button"
                            size="sm"
                            className={geoP0Brand.primary}
                            disabled={enqueueDisabled}
                            data-testid={`weekly-publishable-enqueue-${row.id}`}
                            onClick={() => onEnqueuePublish(row)}
                          >
                            加入发布队列
                          </Button>
                        ) : null}
                        {buttonKind === "queued" ? (
                          <Button
                            type="button"
                            size="sm"
                            className={geoP0Brand.primary}
                            data-testid={`weekly-publishable-go-task-${row.id}`}
                            onClick={onGoPublishingPage}
                          >
                            查看发布任务
                          </Button>
                        ) : null}
                        {buttonKind === "failed" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={geoP0Brand.primaryOutline}
                            data-testid={`weekly-publishable-failure-${row.id}`}
                            onClick={() => onView(row)}
                          >
                            查看失败原因
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
