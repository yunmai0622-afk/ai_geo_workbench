import { Button } from "@/components/ui/button";
import { publishStatusLabel, recordPublicLink } from "@/lib/assetProgressDisplay";
import { formatPublishedAtLabel } from "@/lib/deliveryReportDisplay";
import { geoP0Brand } from "@/lib/geoP0Visual";
import {
  hasMorePublishRecordsThanRecent,
  RECENT_PUBLISH_RECORDS_LIMIT,
  sliceRecentPublishRecords,
  sortPublishRecordsByPublishedAtDesc,
  type PublishRecordArchiveInput,
} from "@shared/publishRecordArchive";

export type PublishRecordsListItem = PublishRecordArchiveInput & {
  id: number;
  articleId?: number | null;
  publishTitle?: string | null;
  publishChannel?: string | null;
  publishStatus?: string | null;
  publishUrl?: string | null;
  publicUrl?: string | null;
};

type PublishRecordsListPanelProps = {
  records: PublishRecordsListItem[];
  loading?: boolean;
  resolveTitle: (record: PublishRecordsListItem) => string;
  onViewAllHistory?: () => void;
  /** recent：默认最近 30 条；full：展示传入的全部记录（用于历史页） */
  variant?: "recent" | "full";
};

export function PublishRecordsListPanel({
  records,
  loading = false,
  resolveTitle,
  onViewAllHistory,
  variant = "recent",
}: PublishRecordsListPanelProps) {
  const displayRecords =
    variant === "full" ? sortPublishRecordsByPublishedAtDesc(records) : sliceRecentPublishRecords(records);
  const showHistoryCta =
    variant === "recent" && hasMorePublishRecordsThanRecent(records) && onViewAllHistory;

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      data-testid="publish-records-list-panel"
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-900">发布记录</h2>
        <p className="mt-1 text-sm text-gray-500">
          {variant === "full"
            ? "展示符合筛选条件的全部发布记录。"
            : `默认展示最近 ${RECENT_PUBLISH_RECORDS_LIMIT} 条；更早记录可在历史中按时间筛选查看。`}
        </p>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-gray-500" data-testid="publish-records-list-loading">
          正在加载发布记录…
        </p>
      ) : records.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500" data-testid="publish-records-list-empty">
          暂无发布记录，完成发布或人工登记后将显示在这里。
        </p>
      ) : (
        <ul className="mt-4 space-y-2" data-testid="publish-records-list">
          {displayRecords.map(record => {
            const link = recordPublicLink(record);
            return (
              <li
                key={record.id}
                className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-3 text-sm"
                data-testid={`publish-record-row-${record.id}`}
              >
                <p className="font-medium text-gray-900">{resolveTitle(record)}</p>
                <p className="mt-1 text-xs text-gray-600">
                  平台：{record.publishChannel?.trim() || "—"} · 状态：
                  {publishStatusLabel(record.publishStatus)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  发布时间：
                  {formatPublishedAtLabel(record.publishedAt as Date | string | null | undefined) ?? "—"}
                </p>
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-blue-600 hover:underline break-all"
                  >
                    {link}
                  </a>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">公开链接未回填</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {records.length > 0 ? (
        <p className="mt-3 text-xs text-gray-400">
          共 {records.length} 条发布记录
          {showHistoryCta ? `，当前显示最近 ${RECENT_PUBLISH_RECORDS_LIMIT} 条` : ""}
        </p>
      ) : null}

      {showHistoryCta ? (
        <div className="mt-4 flex justify-center border-t border-gray-100 pt-4">
          <Button
            type="button"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            data-testid="publish-records-view-all-history"
            onClick={onViewAllHistory}
          >
            查看全部历史
          </Button>
        </div>
      ) : null}
    </section>
  );
}
