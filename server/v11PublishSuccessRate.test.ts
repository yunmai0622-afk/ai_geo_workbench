import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Publish-Success-Rate", () => {
  it("shared builder exposes per-platform success rates", () => {
    const shared = read("shared/deliveryReportPublishStats.ts");
    expect(shared).toContain("buildPlatformPublishSuccessRates");
    expect(shared).toContain("formatPlatformPublishSuccessRateLine");
    expect(shared).toContain("platformSuccessRates");
  });

  it("publish center page shows per-platform success rate panel", () => {
    const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
    const panel = read("client/src/components/publishing/PlatformPublishSuccessRatePanel.tsx");
    expect(page).toContain("PlatformPublishSuccessRatePanel");
    expect(panel).toContain("publishTasks.projectStats");
    expect(panel).toContain("platform-publish-success-rates");
    expect(panel).toContain("各平台发布成功率");
    expect(panel).toContain("formatPlatformPublishSuccessRateLine");
  });
});
