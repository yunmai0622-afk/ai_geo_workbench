import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Publish-Record-Archive", () => {
  it("shared helpers cap recent list at 30 and filter by date range", () => {
    const shared = read("shared/publishRecordArchive.ts");
    expect(shared).toContain("RECENT_PUBLISH_RECORDS_LIMIT = 30");
    expect(shared).toContain("sliceRecentPublishRecords");
    expect(shared).toContain("filterPublishRecordsByDateRange");
  });

  it("publish center shows recent list and view-all-history entry", () => {
    const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
    const panel = read("client/src/components/publishing/PublishRecordsListPanel.tsx");

    expect(page).toContain("publish-center-tab-records");
    expect(page).toContain("PublishRecordsListPanel");
    expect(page).toContain("/publish-records-history");
    expect(panel).toContain("publish-records-view-all-history");
    expect(panel).toContain("查看全部历史");
  });

  it("history page supports date range filters", () => {
    const history = read("client/src/pages/PublishRecordsHistoryPage.tsx");
    const app = read("client/src/App.tsx");

    expect(history).toContain("publish-records-history-page");
    expect(history).toContain("publish-records-history-date-from");
    expect(history).toContain("publish-records-history-date-to");
    expect(history).toContain("filterPublishRecordsByDateRange");
    expect(app).toContain("/publish-records-history");
    expect(app).toContain("PublishRecordsHistoryPage");
  });
});
