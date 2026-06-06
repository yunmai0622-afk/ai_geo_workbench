import { publishStatusLabel } from "@/lib/assetProgressDisplay";
import { Button } from "@/components/ui/button";
import {
  buildMonthCalendarCells,
  formatMonthTitle,
  groupPublishRecordsByDateKey,
  PUBLISH_CALENDAR_WEEKDAY_LABELS,
  toLocalDateKey,
  type PublishCalendarRecordInput,
} from "@shared/publishCalendar";
import { useMemo, useState } from "react";

type PublishRecordsCalendarProps = {
  records: PublishCalendarRecordInput[];
  resolveTitle: (record: PublishCalendarRecordInput) => string;
  loading?: boolean;
};

export function PublishRecordsCalendar({
  records = [],
  resolveTitle,
  loading = false,
}: PublishRecordsCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const todayKey = toLocalDateKey(today);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(todayKey);

  const recordsByDate = useMemo(() => groupPublishRecordsByDateKey(records), [records]);
  const cells = useMemo(
    () => buildMonthCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const selectedRecords = selectedDateKey ? (recordsByDate.get(selectedDateKey) ?? []) : [];

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      data-testid="publish-records-calendar"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">发布日历</h2>
          <p className="mt-1 text-sm text-gray-500">
            按日期查看已登记的发布记录：内容标题、发布平台与发布状态。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => shiftMonth(-1)}>
            上月
          </Button>
          <span className="min-w-[7rem] text-center text-sm font-medium text-gray-800">
            {formatMonthTitle(viewYear, viewMonth)}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => shiftMonth(1)}>
            下月
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">正在加载发布记录…</p>
      ) : records.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">暂无发布记录，完成发布或人工登记后将显示在日历中。</p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500">
            {PUBLISH_CALENDAR_WEEKDAY_LABELS.map(label => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1" data-testid="publish-calendar-grid">
            {cells.map(cell => {
              const dayRecords = recordsByDate.get(cell.dateKey) ?? [];
              const isSelected = selectedDateKey === cell.dateKey;
              const isToday = cell.dateKey === todayKey;
              return (
                <button
                  key={`${cell.dateKey}-${cell.isCurrentMonth ? "in" : "out"}-${cell.dayOfMonth}`}
                  type="button"
                  data-testid={`publish-calendar-day-${cell.dateKey}`}
                  onClick={() => setSelectedDateKey(cell.dateKey)}
                  className={[
                    "flex min-h-[4.5rem] flex-col rounded-lg border p-1.5 text-left text-xs transition-colors",
                    cell.isCurrentMonth ? "border-gray-200 bg-white" : "border-transparent bg-gray-50 text-gray-400",
                    isSelected ? "ring-2 ring-blue-500 ring-offset-1" : "hover:border-blue-200 hover:bg-blue-50/40",
                    isToday && !isSelected ? "border-blue-300" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-flex size-6 items-center justify-center rounded-full font-medium",
                      isToday ? "bg-blue-600 text-white" : "text-gray-700",
                    ].join(" ")}
                  >
                    {cell.dayOfMonth}
                  </span>
                  {dayRecords.length > 0 ? (
                    <span className="mt-1 line-clamp-2 text-[10px] leading-tight text-blue-700">
                      {dayRecords.length} 条发布
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-6 border-t border-gray-100 pt-4" data-testid="publish-calendar-day-detail">
            <h3 className="text-sm font-medium text-gray-800">
              {selectedDateKey ? `${selectedDateKey.replace(/-/g, "/")} 发布记录` : "选择日期"}
            </h3>
            {selectedRecords.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">该日暂无发布记录。</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {selectedRecords.map(record => (
                  <li
                    key={record.id}
                    className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm text-gray-800"
                    data-testid={`publish-calendar-record-${record.id}`}
                  >
                    <p className="font-medium text-gray-900">{resolveTitle(record)}</p>
                    <p className="mt-1 text-xs text-gray-600">
                      平台：{record.publishChannel?.trim() || "—"} · 状态：
                      {publishStatusLabel(record.publishStatus)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {records.length > 0 ? (
        <p className="mt-4 text-xs text-gray-400">
          共 {records.length} 条发布记录；点击日期格查看当日明细。
        </p>
      ) : null}
    </section>
  );
}
