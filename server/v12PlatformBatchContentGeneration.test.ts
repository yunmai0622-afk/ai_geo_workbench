import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Batch-Content-Generation", () => {
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const panel = read("client/src/components/weekly/PlatformBatchGenerationPanel.tsx");
  const shared = read("shared/platformBatchGeneration.ts");

  it("exposes one-click all-platform generation on weekly page", () => {
    expect(weekly).toContain("PlatformBatchGenerationPanel");
    expect(weekly).toContain("handleBatchGenerateAllPlatforms");
    expect(weekly).toContain("runPlatformBatchItem");
    expect(weekly).toContain("platformBatchRunning");
    expect(panel).toContain("一键生成所有平台内容");
    expect(panel).toContain("platform-batch-generate-all");
    expect(panel).toContain("platform-batch-queue");
    expect(panel).toContain("platform-batch-progress");
    expect(panel).toContain("platform-batch-retry-");
  });

  it("sequential queue continues after single platform failure", () => {
    expect(weekly).toContain("for (const def of WEEKLY_PLATFORM_DEFS)");
    expect(weekly).toContain('status: result.ok ? "completed" : "failed"');
    expect(shared).toContain("formatPlatformBatchProgress");
  });
});
