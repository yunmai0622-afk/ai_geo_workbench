import { describe, expect, it } from "vitest";
import {
  PROFILE_COMPLETENESS_LOW_HINT,
  PROFILE_COMPLETENESS_LOW_THRESHOLD,
  evaluateEnterpriseProfileCompletenessFromForm,
  evaluateEnterpriseProfileCompletenessFromProfile,
  isEnterpriseProfileFeaturePath,
} from "./enterpriseProfileCompleteness";

describe("GEO-V1.1-Profile-Completeness", () => {
  it("returns 0% when profile is missing", () => {
    const r = evaluateEnterpriseProfileCompletenessFromProfile(null);
    expect(r.percent).toBe(0);
    expect(r.missingKeys).toHaveLength(8);
    expect(r.showLowCompletenessHint).toBe(true);
  });

  it("returns 100% when all 8 P0 fields are filled", () => {
    const r = evaluateEnterpriseProfileCompletenessFromProfile({
      brandName: "测试企业",
      industryTag: "SaaS",
      oneLiner: "一句话",
      productDesc: "产品",
      targetCustomer: "客户",
      customerPains: ["痛点"],
      keyPoints: ["优势"],
      keywords: ["词"],
    });
    expect(r.percent).toBe(100);
    expect(r.isComplete).toBe(true);
    expect(r.showLowCompletenessHint).toBe(false);
    expect(r.missingLabels).toHaveLength(0);
  });

  it("marks hint when below threshold", () => {
    const r = evaluateEnterpriseProfileCompletenessFromProfile({
      brandName: "测试",
      industryTag: "SaaS",
      oneLiner: "介绍",
      productDesc: "产品",
    });
    expect(r.percent).toBe(50);
    expect(r.percent).toBeLessThan(PROFILE_COMPLETENESS_LOW_THRESHOLD);
    expect(r.showLowCompletenessHint).toBe(true);
  });

  it("evaluates live form state", () => {
    const r = evaluateEnterpriseProfileCompletenessFromForm({
      brandName: "A",
      industryTagValue: "B",
      oneLiner: "",
      productDesc: "",
      targetCustomer: "",
      customerPains: [],
      keyPoints: [],
      keywords: [],
    });
    expect(r.percent).toBe(25);
    expect(r.missingKeys).toContain("oneLiner");
  });

  it("exposes low completeness hint copy", () => {
    expect(PROFILE_COMPLETENESS_LOW_HINT).toContain("完善企业资料");
  });

  it("detects feature paths for banner", () => {
    expect(isEnterpriseProfileFeaturePath("/ai-diagnosis")).toBe(true);
    expect(isEnterpriseProfileFeaturePath("/enterprise-profile")).toBe(false);
    expect(isEnterpriseProfileFeaturePath("/clients")).toBe(false);
  });
});
