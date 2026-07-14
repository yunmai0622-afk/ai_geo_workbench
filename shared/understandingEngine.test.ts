import { describe, expect, it } from "vitest";
import {
  calculateUnderstandingTotalScore,
  classifyUnsupportedClaim,
  compareStatementToTruth,
  DEFAULT_UNDERSTANDING_QUESTION_TEMPLATES,
  deriveUnderstandingSeverity,
  extractUnderstandingFactsByRule,
  recommendCorrectionAction,
  renderUnderstandingQuestion,
  UNDERSTANDING_DIMENSIONS,
} from "./understandingEngine";

const verifiedFact = {
  factKey: "core_business",
  factValue: "知识付费 SaaS 系统",
  verificationStatus: "official_verified" as const,
  sourceCount: 1,
};

describe("Understand Engine", () => {
  it("keeps mention extraction separate from understanding evaluation", () => {
    const extracted = extractUnderstandingFactsByRule("海豚知道可能是一套系统，详见 https://example.com/a", { brandName: "海豚知道" });
    expect(extracted.detectedBrandName).toBe("海豚知道");
    expect(extracted.detectedCitations).toEqual(["https://example.com/a"]);
    expect(extracted.uncertainStatements).toHaveLength(1);
  });

  it("distinguishes missing from inaccurate", () => {
    expect(compareStatementToTruth({ expectedFact: verifiedFact, actualStatement: "" }).status).toBe("missing");
    expect(compareStatementToTruth({ expectedFact: verifiedFact, actualStatement: "它是一家线下培训学校" }).status).toBe("inaccurate");
  });

  it("accepts synonymous wording instead of automatically marking it wrong", () => {
    expect(compareStatementToTruth({ expectedFact: verifiedFact, actualStatement: "它提供知识付费软件即服务系统" }).status).toBe("accurate");
  });

  it("does not judge against an unverified enterprise statement", () => {
    expect(compareStatementToTruth({ expectedFact: { ...verifiedFact, verificationStatus: "provided_unverified" }, actualStatement: "线下培训" }).status).toBe("unverifiable");
  });

  it("distinguishes outdated and suspected hallucination from unverifiable", () => {
    expect(compareStatementToTruth({ expectedFact: verifiedFact, actualStatement: "旧版课程业务", knownOutdatedValues: ["旧版课程业务"] }).status).toBe("outdated");
    expect(classifyUnsupportedClaim({ claim: "提供金融担保", conflictingVerifiedFact: verifiedFact, hasSupportingEvidence: false })).toBe("hallucinated");
    expect(classifyUnsupportedClaim({ claim: "提供金融担保", hasSupportingEvidence: false })).toBe("unverifiable");
  });

  it("classifies P0/P1/P2 independently from the field status", () => {
    expect(deriveUnderstandingSeverity({ factKey: "brand_name", status: "inaccurate" })).toBe("P0");
    expect(deriveUnderstandingSeverity({ factKey: "target_customers", status: "missing" })).toBe("P1");
    expect(deriveUnderstandingSeverity({ factKey: "use_cases", status: "missing" })).toBe("P2");
    expect(deriveUnderstandingSeverity({ factKey: "use_cases", status: "unverifiable", legalOrCommercialRisk: true })).toBe("P0");
  });

  it("returns no fake score when one of eight dimensions is missing", () => {
    const incomplete = calculateUnderstandingTotalScore(UNDERSTANDING_DIMENSIONS.slice(0, 7).map(item => ({ dimension: item.id, score: 80 })));
    expect(incomplete).toMatchObject({ score: null, sufficient: false });
    const complete = calculateUnderstandingTotalScore(UNDERSTANDING_DIMENSIONS.map(item => ({ dimension: item.id, score: 80 })));
    expect(complete).toEqual({ score: 80, sufficient: true, missingDimensions: [] });
  });

  it("keeps the official 15/10/20/15/15/10/10/5 traceable weighting", () => {
    expect(UNDERSTANDING_DIMENSIONS.map(item => item.weight)).toEqual([15, 10, 20, 15, 15, 10, 10, 5]);
    expect(UNDERSTANDING_DIMENSIONS.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
  });

  it("supports default, high-risk and fixed project question semantics", () => {
    expect(DEFAULT_UNDERSTANDING_QUESTION_TEMPLATES).toHaveLength(21);
    expect(renderUnderstandingQuestion("[品牌] 和 [公司主体] 是什么关系？", { brandName: "海豚知道", companyName: "示例公司" })).toBe("海豚知道 和 示例公司 是什么关系？");
  });

  it("generates non-article correction actions for website, FAQ, Schema, cases and outdated sources", () => {
    expect(recommendCorrectionAction("brand_company_relation").actionType).toBe("organization_schema");
    expect(recommendCorrectionAction("target_customers").actionType).toBe("faq");
    expect(recommendCorrectionAction("core_business").actionType).toBe("official_definition_page");
    expect(recommendCorrectionAction("core_capabilities").actionType).toBe("customer_case");
    expect(recommendCorrectionAction("outdated_data").actionType).toBe("update_old_content");
  });
});
