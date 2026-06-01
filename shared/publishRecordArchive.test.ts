import { describe, expect, it } from "vitest";
import {
  filterPublishRecordsByDateRange,
  hasMorePublishRecordsThanRecent,
  RECENT_PUBLISH_RECORDS_LIMIT,
  sliceRecentPublishRecords,
} from "./publishRecordArchive";

describe("GEO-V1.1-Publish-Record-Archive", () => {
  const records = Array.from({ length: 35 }, (_, i) => ({
    id: i + 1,
    publishedAt: new Date(2026, 0, 35 - i),
  }));

  it("sliceRecentPublishRecords keeps newest 30 by default", () => {
    const recent = sliceRecentPublishRecords(records);
    expect(recent).toHaveLength(RECENT_PUBLISH_RECORDS_LIMIT);
    expect(recent[0]?.id).toBe(1);
    expect(recent[29]?.id).toBe(30);
  });

  it("hasMorePublishRecordsThanRecent detects overflow", () => {
    expect(hasMorePublishRecordsThanRecent(records)).toBe(true);
    expect(hasMorePublishRecordsThanRecent(records.slice(0, 30))).toBe(false);
  });

  it("filterPublishRecordsByDateRange filters inclusive local dates", () => {
    const filtered = filterPublishRecordsByDateRange(records, {
      from: "2026-01-10",
      to: "2026-01-15",
    });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(r => r.id >= 21 && r.id <= 26)).toBe(true);
  });
});
