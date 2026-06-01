/** GEO-V1.1-Publish-Calendar：发布记录按本地日期分组与月历格生成 */

export type PublishCalendarRecordInput = {
  id: number;
  articleId?: number | null;
  publishTitle?: string | null;
  publishChannel?: string | null;
  publishStatus?: string | null;
  publishedAt?: Date | string | number | null;
};

export type PublishCalendarDayCell = {
  date: Date;
  dateKey: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
};

export function toLocalDateKey(value: Date | string | number): string {
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function resolvePublishRecordDateKey(
  record: Pick<PublishCalendarRecordInput, "publishedAt">,
): string | null {
  if (record.publishedAt == null) return null;
  const t = new Date(record.publishedAt).getTime();
  if (Number.isNaN(t)) return null;
  return toLocalDateKey(new Date(t));
}

export function groupPublishRecordsByDateKey<T extends PublishCalendarRecordInput>(
  records: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const record of records) {
    const key = resolvePublishRecordDateKey(record);
    if (!key) continue;
    const bucket = map.get(key);
    if (bucket) bucket.push(record);
    else map.set(key, [record]);
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => {
      const ta = new Date(a.publishedAt ?? 0).getTime();
      const tb = new Date(b.publishedAt ?? 0).getTime();
      return tb - ta;
    });
  }
  return map;
}

/** 月历格：周一为首列，含上月/下月补位 */
export function buildMonthCalendarCells(year: number, monthIndex: number): PublishCalendarDayCell[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startPad = (firstOfMonth.getDay() + 6) % 7;
  const cells: PublishCalendarDayCell[] = [];

  for (let i = startPad - 1; i >= 0; i--) {
    const date = new Date(year, monthIndex, -i);
    cells.push({
      date,
      dateKey: toLocalDateKey(date),
      dayOfMonth: date.getDate(),
      isCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day);
    cells.push({
      date,
      dateKey: toLocalDateKey(date),
      dayOfMonth: day,
      isCurrentMonth: true,
    });
  }

  let trailing = 1;
  while (cells.length % 7 !== 0) {
    const date = new Date(year, monthIndex + 1, trailing);
    cells.push({
      date,
      dateKey: toLocalDateKey(date),
      dayOfMonth: date.getDate(),
      isCurrentMonth: false,
    });
    trailing += 1;
  }

  return cells;
}

export function formatMonthTitle(year: number, monthIndex: number): string {
  return `${year}年${monthIndex + 1}月`;
}

export const PUBLISH_CALENDAR_WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"] as const;
