import { describe, expect, it } from "vitest";
import {
  buildOnboardingCompletenessReport,
  resolveCompletenessDimensionStatus,
  resolveCompletenessDimensionStatusIcon,
} from "./onboardingCompletenessReport";

describe("onboarding completeness report", () => {
  it("builds 8-dimension report with top gaps and next step", () => {
    const report = buildOnboardingCompletenessReport({
      profile: {
        brandName: "海豚知道",
        enterpriseName: "海豚知道科技",
        oneLiner: "知识付费 SaaS",
        officialWebsite: "https://example.com",
        region: "北京",
        industryTag: "教育",
        productDesc: "课程交付系统",
        keyPoints: ["交付快"],
        keywords: ["知识付费"],
        targetCustomer: "培训机构",
        customerPains: ["获客难"],
        competitors: ["小鹅通"],
        wizardStep: 5,
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
      questionCount: 8,
      customerCaseCount: 1,
      trustEvidenceCount: 2,
      verifiedTrustEvidenceCount: 1,
      brandSourceCount: 3,
      brandSourcePlatforms: ["知乎", "公众号"],
    });

    expect(report.totalScore).toBeGreaterThan(0);
    expect(report.totalScore).toBeLessThanOrEqual(100);
    expect(report.dimensions.brandIdentity.score).toBeGreaterThan(0);
    expect(report.dimensions.questionCoverage.totalQuestions).toBe(8);
    expect(report.dimensions.questionCoverage.targetQuestions).toBe(30);
    expect(report.dimensions.trustEvidence.verifiedCount).toBe(1);
    expect(report.dimensions.trustEvidence.customerCasesCount).toBe(1);
    expect(report.dimensions.sourceGraph.platformsCovered).toEqual(["知乎", "公众号"]);
    expect(report.topMissingItems.length).toBeGreaterThan(0);
    expect(report.topMissingItems.length).toBeLessThanOrEqual(3);
    expect(report.nextStepSuggestion.length).toBeGreaterThan(0);
    expect(report.wizardStep).toBe(5);
    expect(report.lastUpdatedAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("maps score bands to customer-facing status", () => {
    expect(resolveCompletenessDimensionStatus(85)).toBe("complete");
    expect(resolveCompletenessDimensionStatus(60)).toBe("partial");
    expect(resolveCompletenessDimensionStatus(20)).toBe("empty");
    expect(resolveCompletenessDimensionStatusIcon(85)).toBe("✅");
    expect(resolveCompletenessDimensionStatusIcon(60)).toBe("🟡");
    expect(resolveCompletenessDimensionStatusIcon(20)).toBe("❌");
  });
});
