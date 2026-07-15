import { describe, expect, it } from "vitest";
import { brandTruthVerificationPlanSchema } from "./brandTruthVerificationBatch";

function validPlan() {
  return {
    expectedProfileVersion: 1,
    targetProfileVersion: 2,
    changeReason: "完成第一批公开事实核验",
    reviewerNote: "运营已逐项查看公开来源",
    evidence: [
      {
        key: "official",
        evidenceType: "官网",
        title: "示例官网",
        url: "https://example.com/",
        publisher: "示例公司",
        sourceOwner: "示例公司",
        sourceClass: "official" as const,
        independentSource: false,
        authorityLevel: "high" as const,
        freshnessStatus: "current" as const,
        consistencyStatus: "consistent" as const,
        evidenceExcerpt: "示例品牌提供企业服务。",
        capturedAt: "2026-07-15T00:00:00.000Z",
      },
      {
        key: "third_party",
        evidenceType: "第三方平台",
        title: "第三方公司页",
        url: "https://third.example/company",
        publisher: "第三方平台",
        sourceOwner: "第三方平台",
        sourceClass: "third_party" as const,
        independentSource: true,
        authorityLevel: "medium" as const,
        freshnessStatus: "current" as const,
        consistencyStatus: "consistent" as const,
        evidenceExcerpt: "示例品牌属于示例公司。",
        capturedAt: "2026-07-15T00:00:00.000Z",
      },
    ],
    facts: [
      {
        category: "identity" as const,
        factType: "brand_name",
        factKey: "brand_name",
        factValue: "示例品牌",
        importance: "critical" as const,
        verificationStatus: "multi_source_verified" as const,
        supportEvidenceKeys: ["official", "third_party"],
        contextEvidenceKeys: [],
      },
    ],
    conflicts: [],
    questionSet: {
      name: "首次 Understand 固定问题集",
      questions: Array.from({ length: 15 }, (_, index) => ({
        category: "identity",
        questionType: "system_default" as const,
        questionText: `示例品牌问题 ${index + 1}？`,
        verificationFactKeys: ["brand_name"],
      })),
    },
  };
}

describe("Brand Truth verification batch", () => {
  it("accepts one atomic profile version with qualified evidence and exactly 15 questions", () => {
    const parsed = brandTruthVerificationPlanSchema.parse(validPlan());
    expect(parsed.targetProfileVersion).toBe(2);
    expect(parsed.questionSet.questions).toHaveLength(15);
  });

  it("refuses to skip a profile version", () => {
    const plan = validPlan();
    plan.targetProfileVersion = 3;
    expect(() => brandTruthVerificationPlanSchema.parse(plan)).toThrow("目标版本必须等于当前版本 + 1");
  });

  it("refuses verified facts that do not link supporting evidence", () => {
    const plan = validPlan();
    plan.facts[0]!.supportEvidenceKeys = [];
    expect(() => brandTruthVerificationPlanSchema.parse(plan)).toThrow("已核验事实必须关联支持证据");
  });

  it("keeps project identity outside the plan so the workflow is not sample-specific", () => {
    const parsed = brandTruthVerificationPlanSchema.parse(validPlan());
    expect("projectId" in parsed).toBe(false);
  });
});
