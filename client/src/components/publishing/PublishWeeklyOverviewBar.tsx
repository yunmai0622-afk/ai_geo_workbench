import { P0Card } from "@/components/geo/P0UiPrimitives";
import {
  formatPublishOverviewTime,
  type WeeklyPublishOverviewStats,
} from "@shared/publishPageLayout";

type Props = {
  stats: WeeklyPublishOverviewStats;
  loading?: boolean;
};

export function PublishWeeklyOverviewBar({ stats, loading }: Props) {
  const items = [
    { label: "已生成", value: loading ? "—" : String(stats.generatedCount), testId: "publish-overview-generated" },
    { label: "可发布", value: loading ? "—" : String(stats.publishableCount), testId: "publish-overview-publishable" },
    { label: "已入队", value: loading ? "—" : String(stats.queuedCount), testId: "publish-overview-queued" },
    { label: "已发布", value: loading ? "—" : String(stats.publishedCount), testId: "publish-overview-published" },
    { label: "待回填链接", value: loading ? "—" : String(stats.waitingLinksCount), testId: "publish-overview-waiting-links" },
    {
      label: "上次发布时间",
      value: loading ? "—" : formatPublishOverviewTime(stats.lastPublishedAt),
      testId: "publish-overview-last-published",
    },
  ];

  return (
    <P0Card testId="publish-weekly-overview-bar">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">本周内容概览</h2>
          <p className="mt-0.5 text-sm text-gray-600">统计本周已生成、已发布与待发布内容，便于安排各平台发布节奏。</p>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {items.map(item => (
          <div
            key={item.label}
            className="rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3"
            data-testid={item.testId}
          >
            <dt className="text-xs font-medium text-gray-500">{item.label}</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">{item.value}</dd>
          </div>
        ))}
      </dl>
    </P0Card>
  );
}
