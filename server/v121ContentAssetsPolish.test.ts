import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");
describe("GEO-V1.1 Content Assets Polish", () => {
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const card = read("client/src/components/weekly/WeeklyPlatformArticleCard.tsx");
  const display = read("shared/weeklyContentAssetsDisplay.ts");
  const batchPanel = read("client/src/components/weekly/PlatformBatchGenerationPanel.tsx");
  it("weekly page wires filters, batch enqueue, and display helpers", () => {
    expect(weekly).toContain("weeklyContentAssetsDisplay");
    expect(weekly).toContain("publishRecordsQuery");
    expect(weekly).toContain("displayContentCards");
    expect(weekly).toContain("weekly-filter-platform");
    expect(weekly).toContain("weekly-batch-enqueue-publish");
    expect(weekly).toContain("PlatformBatchGenerationPanel");
    expect(weekly).toContain("platformBatchRunning");
  });
  it("content card shows cover, type, publish link, and selection", () => {
    expect(card).toContain("ContentCardStatus");
    expect(card).toContain("coverThumbnailSrc");
    expect(card).toContain("weekly-card-publish-link");
    expect(card).toContain("Checkbox");
    expect(card).toContain("selectable");
  });
  it("shared display helpers cover status, cover, and publish link", () => {
    expect(display).toContain("resolveArticlePublishLink");
    expect(display).toContain("filterWeeklyContentCards");
  });
  it("platform batch panel exposes queue progress test ids", () => {
    expect(batchPanel).toContain("platform-batch-generation-panel");
  });
});
