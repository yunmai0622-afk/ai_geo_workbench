/** GEO-V1.1-Publish-Record-Archive：发布记录最近条数与历史时间筛选 */

export const RECENT_PUBLISH_RECORDS_LIMIT = 30;

export type PublishRecordArchiveInput = {
  id: number;
  publishedAt?: Date | string | number | null;
};

export function publishRecordPublishedAtMs(
  record: Pick<PublishRecordArchiveInput, "publishedAt">,
): number {
  if (record.publishedAt == null) return 0;
  const t = new Date(record.publishedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function sortPublishRecordsByPublishedAtDesc<T extends PublishRecordArchiveInput>(
  records: T[],
): T[] {
  return [...records].sort(
    (a, b) => publishRecordPublishedAtMs(b) - publishRecordPublishedAtMs(a),
  );
}

export function sliceRecentPublishRecords<T extends PublishRecordArchiveInput>(
  records: T[],
  limit = RECENT_PUBLISH_RECORDS_LIMIT,
): T[] {
  return sortPublishRecordsByPublishedAtDesc(records).slice(0, limit);
}

export type PublishRecordDateRangeFilter = {
  from?: string | null;
  to?: string | null;
};

function parseLocalDateKey(value: string): Date | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [y, m, d] = trimmed.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

function recordLocalDateKey(record: PublishRecordArchiveInput): string | null {
  const ms = publishRecordPublishedAtMs(record);
  if (ms <= 0) return null;
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 按本地日期闭区间筛选；from/to 为 YYYY-MM-DD */
export function filterPublishRecordsByDateRange<T extends PublishRecordArchiveInput>(
  records: T[],
  filter: PublishRecordDateRangeFilter,
): T[] {
  const fromDate = filter.from ? parseLocalDateKey(filter.from) : null;
  const toDate = filter.to ? parseLocalDateKey(filter.to) : null;
  if (!fromDate && !toDate) {
    return sortPublishRecordsByPublishedAtDesc(records);
  }

  const fromKey = fromDate
    ? `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}-${String(fromDate.getDate()).padStart(2, "0")}`
    : null;
  const toKey = toDate
    ? `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`
    : null;

  return sortPublishRecordsByPublishedAtDesc(records).filter(record => {
    const key = recordLocalDateKey(record);
    if (!key) return false;
    if (fromKey && key < fromKey) return false;
    if (toKey && key > toKey) return false;
    return true;
  });
}

export function hasMorePublishRecordsThanRecent(
  records: unknown[],
  limit = RECENT_PUBLISH_RECORDS_LIMIT,
): boolean {
  return records.length > limit;
}
