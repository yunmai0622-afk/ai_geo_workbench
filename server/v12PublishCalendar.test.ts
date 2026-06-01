import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Publish-Calendar", () => {
  it("publish center exposes calendar tab and month grid", () => {
    const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
    const calendar = read("client/src/components/publishing/PublishRecordsCalendar.tsx");
    const shared = read("shared/publishCalendar.ts");

    expect(page).toContain("发布日历");
    expect(page).toContain("publish-calendar-tab");
    expect(page).toContain("PublishRecordsCalendar");
    expect(calendar).toContain("publish-records-calendar");
    expect(calendar).toContain("publish-calendar-grid");
    expect(calendar).toContain("平台：");
    expect(calendar).toContain("publishStatusLabel");
    expect(shared).toContain("buildMonthCalendarCells");
    expect(shared).toContain("groupPublishRecordsByDateKey");
  });
});
