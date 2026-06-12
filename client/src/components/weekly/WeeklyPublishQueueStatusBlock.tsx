import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
export type WeeklyPublishQueueStats = { queued: number; pendingPublish: number; published: number; pendingLinkBackfill: number; };
type Props = { stats: WeeklyPublishQueueStats; onGoPublishingCenter?: () => void; };
export function WeeklyPublishQueueStatusBlock({ stats, onGoPublishingCenter }: Props) {
  return (
    <section id="weekly-section-publish-queue-status" className="scroll-mt-24 space-y-4" data-testid="weekly-publish-queue-status-block">
      <div className="space-y-1"><h2 className={geoP0Surfaces.sectionTitle}>发布队列进度</h2><p className={geoP0Surfaces.muted}>查看内容从入队到发布、回填链接的推进情况。</p></div>
      <P0Card testId="weekly-publish-queue-status-card">
        <dl className="grid gap-3 text-sm text-gray-800 sm:grid-cols-2 lg:grid-cols-4">
          <div data-testid="weekly-queue-stat-queued"><dt className="text-xs font-medium text-gray-500">已入队</dt><dd className="mt-1 text-lg font-semibold text-gray-900">{stats.queued}</dd></div>
          <div data-testid="weekly-queue-stat-pending-publish"><dt className="text-xs font-medium text-gray-500">待发布</dt><dd className="mt-1 text-lg font-semibold text-gray-900">{stats.pendingPublish}</dd></div>
          <div data-testid="weekly-queue-stat-published"><dt className="text-xs font-medium text-gray-500">已发布</dt><dd className="mt-1 text-lg font-semibold text-gray-900">{stats.published}</dd></div>
          <div data-testid="weekly-queue-stat-pending-link"><dt className="text-xs font-medium text-gray-500">待回填链接</dt><dd className="mt-1 text-lg font-semibold text-gray-900">{stats.pendingLinkBackfill}</dd></div>
        </dl>
        {onGoPublishingCenter ? <div className="mt-4"><Button type="button" size="sm" variant="outline" className={geoP0Brand.primaryOutline} data-testid="weekly-go-publishing-center" onClick={onGoPublishingCenter}>去发布中心</Button></div> : null}
      </P0Card>
    </section>
  );
}
