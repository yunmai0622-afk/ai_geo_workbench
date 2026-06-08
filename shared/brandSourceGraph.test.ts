import { describe, expect, it } from "vitest";
import {
  buildEnhancementSuggestions,
  computeConsistencyScore,
  groupBrandSourcesByPlatformType,
  type BrandSourceRecordRow,
} from "./brandSourceGraph";

function makeRecord(partial: Partial<BrandSourceRecordRow> & Pick<BrandSourceRecordRow, "id" | "platform">): BrandSourceRecordRow {
  return {
    projectId: 1,
    isPubliclyAccessible: true,
    containsBrandName: true,
    containsOfficialSite: true,
    containsCoreKeywords: true,
    aiCitationConfirmed: true,
    isCrossSourceConsistent: true,
    ...partial,
  };
}

describe("brandSourceGraph scoring", () => {
  it("returns 0-100 total score and per-metric pass rates", () => {
    const records = [
      makeRecord({ id: 1, platform: "official_site", containsBrandName: false }),
      makeRecord({ id: 2, platform: "zhihu", aiCitationConfirmed: false }),
    ];
    const score = computeConsistencyScore(records);
    expect(score.totalScore).toBeGreaterThanOrEqual(0);
    expect(score.totalScore).toBeLessThanOrEqual(100);
    expect(score.metricScores).toHaveLength(6);
    expect(score.metricScores.find(item => item.key === "containsBrandName")?.passRate).toBe(50);
  });

  it("groups sources by platform type buckets", () => {
    const records = [
      makeRecord({ id: 1, platform: "official_site" }),
      makeRecord({ id: 2, platform: "zhihu" }),
      makeRecord({ id: 3, platform: "other", platformName: "垂直社区" }),
    ];
    const grouped = groupBrandSourcesByPlatformType(records);
    expect(grouped.find(g => g.key === "official")?.records).toHaveLength(1);
    expect(grouped.find(g => g.key === "knowledge")?.records).toHaveLength(1);
    expect(grouped.find(g => g.key === "other")?.records).toHaveLength(1);
  });

  it("builds enhancement suggestions when records have gaps", () => {
    const records = [
      makeRecord({ id: 1, platform: "zhihu", containsBrandName: false, aiCitationConfirmed: false }),
    ];
    const suggestions = buildEnhancementSuggestions(
      records,
      [
        {
          id: 10,
          projectId: 1,
          questionText: "哪家知识付费平台好用？",
          requiredSourceTypes: ["zhihu"],
        },
      ],
      { projectId: 1, coreKeywords: ["知识付费"], brandName: "海豚知道" },
    );
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some(item => item.description.includes("品牌名"))).toBe(true);
  });
});
