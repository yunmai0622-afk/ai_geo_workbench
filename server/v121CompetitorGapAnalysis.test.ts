import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("GEO-V1.1-Competitor-Gap-Analysis", () => {
  it("analyzes ai_test_runs competitor mentions by question type", () => {
    expect(read("shared/competitorGapSuggestions.ts")).toContain("buildCompetitorGapSuggestions");
    expect(read("server/competitorAnalysis.ts")).toContain("buildCompetitorGapSuggestions");
    expect(read("shared/competitorGapSuggestions.ts")).toContain(
      "竞品在${typeLabel}类问题上被提及${competitorMentionCount}次",
    );
  });

  it("renders gap suggestions module on competitor analysis page", () => {
    const section = read("client/src/components/enterpriseProfile/CompetitorAnalysisSection.tsx");
    expect(section).toContain("缺口建议");
    expect(section).toContain("competitor-gap-suggestions");
    expect(section).toContain("gapSuggestions");
    expect(section).toContain("AI 实测结果");
  });
});
