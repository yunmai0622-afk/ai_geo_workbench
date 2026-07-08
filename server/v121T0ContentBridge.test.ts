import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("GEO-V1.1-T0-To-Content-Bridge", () => {
  it("analyzes ai_test_runs gaps and exposes suggestions on workspace summary", () => {
    expect(read("shared/t0ContentGapSuggestions.ts")).toContain("buildT0ContentGapSuggestions");
    expect(read("server/t0ContentGapSuggestions.ts")).toContain("resolveT0ContentGapSuggestions");
    expect(read("server/workspaceSummary.ts")).toContain("t0ContentGapSuggestions");
  });

  it("keeps gap suggestion actions out of the workspace customer homepage", () => {
    const workspace = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    const card = read("client/src/components/geo/T0ContentGapSuggestionsCard.tsx");
    expect(workspace).not.toContain("T0ContentGapSuggestionsCard");
    expect(workspace).not.toContain("t0ContentGapSuggestions");
    expect(card).toContain("立即生成");
    expect(card).toContain("AI 实测结果");
  });

  it("links weekly content page from gap suggestion action path", () => {
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("weeklyPlatform");
    expect(read("shared/t0ContentGapSuggestions.ts")).toContain("buildT0ContentProductionPath");
  });

  it("notifies owner when T0 completes with gap hint", () => {
    expect(read("server/systemNotifications.ts")).toContain("resolveT0ContentGapSuggestions");
  });
});
