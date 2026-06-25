import { describe, expect, it } from "vitest";
import {
  buildEnhancementSuggestions,
  computeConsistencyScore,
  computeEntityConsistencyChecks,
  computePageTopMetrics,
  extractEnterpriseProfileStandard,
  groupBrandSourcesByPlatformType,
  resolveSourceRecommendationSupport,
  resolveSourceTrustLevel,
  resolveSourceVerificationStatus,
  sortBrandSourcesByPriority,
  type BrandSourceRecordRow,
} from "./brandSourceGraph";

function makeRecord(partial: Partial<BrandSourceRecordRow> & Pick<BrandSourceRecordRow, "id" | "platform">): BrandSourceRecordRow {
  return {
    projectId: 1,
    isPubliclyAccessible: true,
    containsBrandName: true,
    containsBusinessDescription: true,
    containsOfficialSite: true,
    containsCoreKeywords: true,
    aiCitationConfirmed: true,
    isCrossSourceConsistent: true,
    riskLevel: "low",
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

  it("computes entity consistency checks from enterprise profile standard", () => {
    const records = [
      makeRecord({ id: 1, platform: "zhihu", containsBrandName: false }),
      makeRecord({ id: 2, platform: "official_site", containsBrandName: true }),
    ];
    const standard = extractEnterpriseProfileStandard({
      profile: {
        enterpriseName: "测试公司",
        brandName: "测试品牌",
        productServiceIntro: "知识付费 SaaS",
        targetCustomer: "培训机构",
        officialWebsite: "https://example.com",
        keywords: ["知识付费", "SaaS"],
        hasCases: true,
      },
    });
    const checks = computeEntityConsistencyChecks(records, standard);
    expect(checks).toHaveLength(8);
    expect(checks.find(item => item.anchorType === "brand_name")?.status).toBe("conflict");
    const metrics = computePageTopMetrics(records, checks);
    expect(metrics.priorityFixCount).toBeGreaterThan(0);
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
    expect(suggestions.some(item => item.description.includes("品牌") || item.description.includes("关键信息"))).toBe(true);
  });

  it("resolves trust level, verification status and recommendation support", () => {
    const official = makeRecord({
      id: 1,
      platform: "official_site",
      sourceName: "海豚知道官网介绍",
      lastVerifiedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(resolveSourceTrustLevel(official)).toBe("high");
    expect(resolveSourceVerificationStatus(official)).toBe("valid");
    expect(
      resolveSourceRecommendationSupport({
        sourceName: "客户成功案例：培训机构",
        platform: "case_page",
      }),
    ).toBe("customer_case");
  });

  it("sorts sources by priority with invalid at bottom", () => {
    const sorted = sortBrandSourcesByPriority([
      makeRecord({ id: 1, platform: "other", isPubliclyAccessible: false, lastVerifiedAt: "2026-06-01T00:00:00.000Z" }),
      makeRecord({ id: 2, platform: "official_site" }),
      makeRecord({ id: 3, platform: "zhihu", lastVerifiedAt: "2026-06-01T00:00:00.000Z" }),
    ]);
    expect(sorted[0]?.platform).toBe("official_site");
    expect(sorted[sorted.length - 1]?.platform).toBe("other");
  });
});
