import { describe, expect, it } from "vitest";
import {
  buildMonthCalendarCells,
  groupPublishRecordsByDateKey,
  resolvePublishRecordDateKey,
  toLocalDateKey,
} from "./publishCalendar";

describe("publishCalendar", () => {
  it("toLocalDateKey uses local calendar day", () => {
    const key = toLocalDateKey(new Date(2026, 5, 1, 23, 30));
    expect(key).toBe("2026-06-01");
  });

  it("groups records by publishedAt date", () => {
    const map = groupPublishRecordsByDateKey([
      { id: 1, publishTitle: "A", publishedAt: new Date(2026, 0, 10, 12, 0) },
      { id: 2, publishTitle: "B", publishedAt: new Date(2026, 0, 10, 8, 0) },
      { id: 3, publishTitle: "C", publishedAt: new Date(2026, 0, 11, 8, 0) },
    ]);
    expect(map.get("2026-01-10")?.map(r => r.id)).toEqual([1, 2]);
    expect(map.get("2026-01-11")?.map(r => r.id)).toEqual([3]);
  });

  it("buildMonthCalendarCells pads to full weeks starting Monday", () => {
    const cells = buildMonthCalendarCells(2026, 0);
    expect(cells.length % 7).toBe(0);
    expect(cells.filter(c => c.isCurrentMonth).length).toBe(31);
    expect(cells.find(c => c.isCurrentMonth && c.dayOfMonth === 1)?.dateKey).toBe("2026-01-01");
  });

  it("resolvePublishRecordDateKey returns null for invalid date", () => {
    expect(resolvePublishRecordDateKey({ publishedAt: "not-a-date" })).toBeNull();
  });
});
