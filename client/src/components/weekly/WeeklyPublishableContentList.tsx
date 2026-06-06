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

export type WeeklyPublishableRow = WeeklyArticleCardModel & {
  aiQcStatus: WeeklyAiQcDisplayStatus;
  manualReviewStatus: WeeklyManualReviewDisplayStatus;
  coverStatus: WeeklyCoverDisplayStatus;
  accountStatus: WeeklyAccountDisplayStatus;
  publishStatus: WeeklyPublishDisplayStatus;
  queueFailed?: boolean;
};

type Props = {
  rows: WeeklyPublishableRow[];
  disabled?: boolean;
  onView: (model: WeeklyArticleCardModel) => void;
  onReviewConfirm: (model: WeeklyArticleCardModel) => void;
  onEnqueuePublish: (model: WeeklyArticleCardModel) => void;
  onGoPublishingPage?: () => void;
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
  onView,
  onReviewConfirm,
  onEnqueuePublish,
  onGoPublishingPage,
}: Props) {
  return (
    <section
      id="weekly-section-publishable-content"
      className="scroll-mt-24 space-y-4"
      data-testid="weekly-publishable-content-list"
    >
      <div className="space-y-1">
        <h2 className={geoP0Surfaces.sectionTitle}>可发布内容</h2>
        <p className={geoP0Surfaces.muted}>通过 AI 质检的内容在此审核并加入发布队列。</p>
      </div>

      {rows.length === 0 ? (
        <P0Card testId="weekly-publishable-empty">
          <p className="text-sm font-medium text-gray-800">暂无可发布内容</p>
          <p className="mt-1 text-sm text-gray-600">原因：内容尚未生成或未通过 AI 质检。</p>
          <p className="mt-1 text-xs text-gray-500">下一步：先生成并完成平台内容质检。</p>
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
              {rows.map(row => {
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
                    <td className="px-4 py-3 text-gray-700" data-testid={`weekly-publishable-publish-status-${row.id}`}>
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
                        {manualPending && row.aiQcStatus === "通过" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={geoP0Brand.primaryOutline}
                            disabled={disabled}
                            data-testid={`weekly-publishable-review-${row.id}`}
                            onClick={() => onReviewConfirm(row)}
                          >
                            审核确认
                          </Button>
                        ) : null}
                        {buttonKind === "queued" ? (
                          <Button
                            type="button"
                            size="sm"
                            className={geoP0Brand.primary}
                            data-testid={`weekly-publishable-go-${row.id}`}
                            onClick={onGoPublishingPage}
                          >
                            去发布
                          </Button>
                        ) : (
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
                        )}
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
