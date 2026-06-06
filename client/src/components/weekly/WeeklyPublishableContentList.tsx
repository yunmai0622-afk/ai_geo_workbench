import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import {
  WEEKLY_CONTENT_TASK_STATUS_BADGE_CLASS,
  weeklyContentTaskStatusLabel,
  type WeeklyContentTaskStatus,
} from "@shared/weeklyContentTaskStatus";
import type { WeeklyArticleCardModel } from "@/components/weekly/WeeklyPlatformArticleCard";
import { cn } from "@/lib/utils";

export type WeeklyPublishableRow = WeeklyArticleCardModel & {
  taskStatus: WeeklyContentTaskStatus;
  coverReady: boolean;
  accountReady: boolean;
};

type Props = {
  rows: WeeklyPublishableRow[];
  disabled?: boolean;
  onView: (model: WeeklyArticleCardModel) => void;
  onEnqueuePublish: (model: WeeklyArticleCardModel) => void;
  onGoPublishingPage?: () => void;
};

export function WeeklyPublishableContentList({
  rows,
  disabled,
  onView,
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
        <p className={geoP0Surfaces.muted}>仅展示已通过质检、可加入发布队列的内容。</p>
      </div>

      {rows.length === 0 ? (
        <P0Card testId="weekly-publishable-empty">
          <p className="text-sm font-medium text-gray-800">暂无可发布内容</p>
          <p className="mt-1 text-sm text-gray-600">
            原因：内容尚未生成或未通过质检。
          </p>
          <p className="mt-1 text-xs text-gray-500">下一步：先生成并质检平台内容。</p>
        </P0Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500">
              <tr>
                <th className="px-4 py-3">平台</th>
                <th className="px-4 py-3">标题</th>
                <th className="px-4 py-3">质检状态</th>
                <th className="px-4 py-3">封面状态</th>
                <th className="px-4 py-3">账号状态</th>
                <th className="px-4 py-3">发布状态</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => (
                <tr key={row.id} data-testid={`weekly-publishable-row-${row.id}`}>
                  <td className="px-4 py-3 text-gray-800">{row.targetPlatform ?? "—"}</td>
                  <td className="max-w-[12rem] truncate px-4 py-3 font-medium text-gray-900">
                    {row.title}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                        WEEKLY_CONTENT_TASK_STATUS_BADGE_CLASS[row.taskStatus],
                      )}
                    >
                      {weeklyContentTaskStatusLabel(row.taskStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.coverReady ? "已就绪" : "待补充"}</td>
                  <td className="px-4 py-3 text-gray-700">{row.accountReady ? "已绑定" : "待绑定"}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.queuedForPublish ? row.queuedStatusLabel ?? "已入队" : "待入队"}
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
                      {row.queuedForPublish ? (
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
                          disabled={disabled || !row.publishPreflightReady}
                          data-testid={`weekly-publishable-enqueue-${row.id}`}
                          onClick={() => onEnqueuePublish(row)}
                        >
                          加入发布队列
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
