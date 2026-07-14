import { describe, expect, it } from "vitest";
import {
  BRAND_TRUTH_STATUS_LABELS,
  calculateTruthProfileStats,
  canUseFactAsConfirmedTruth,
  listBrandTruthFactDefinitions,
  normalizeTruthValue,
} from "./brandTruth";

describe("Brand Truth Engine", () => {
  it("covers the four formal fact categories and required fact metadata dictionary", () => {
    const definitions = listBrandTruthFactDefinitions();
    expect(new Set(definitions.map(item => item.category))).toEqual(new Set(["identity", "business", "capability_boundary", "temporal"]));
    expect(definitions.map(item => item.key)).toEqual(expect.arrayContaining(["brand_name", "company_name", "official_website", "core_business", "target_customers", "prohibited_promises", "outdated_data"]));
    expect(definitions.length).toBeGreaterThanOrEqual(40);
  });

  it("never treats enterprise-provided input as confirmed truth", () => {
    expect(canUseFactAsConfirmedTruth({ verificationStatus: "provided_unverified", sourceCount: 4 })).toBe(false);
    expect(canUseFactAsConfirmedTruth({ verificationStatus: "official_verified", sourceCount: 0 })).toBe(false);
    expect(canUseFactAsConfirmedTruth({ verificationStatus: "official_verified", sourceCount: 1 })).toBe(true);
  });

  it("publishes customer-readable labels for every fact state", () => {
    expect(BRAND_TRUTH_STATUS_LABELS).toEqual({
      provided_unverified: "待核验",
      official_verified: "官方已确认",
      third_party_verified: "第三方已确认",
      multi_source_verified: "多来源一致",
      conflicting: "来源冲突",
      outdated: "信息过时",
      deprecated: "已停用",
      unknown: "暂无法确认",
    });
  });

  it("calculates profile completeness, verification, conflicts and outdated facts independently", () => {
    const stats = calculateTruthProfileStats([
      { factKey: "brand_name", verificationStatus: "official_verified" },
      { factKey: "core_business", verificationStatus: "provided_unverified" },
      { factKey: "target_customers", verificationStatus: "conflicting" },
      { factKey: "outdated_data", verificationStatus: "outdated" },
    ]);
    expect(stats.verifiedFactRate).toBe(25);
    expect(stats.conflictCount).toBe(1);
    expect(stats.outdatedFactCount).toBe(1);
    expect(stats.completenessScore).toBeGreaterThan(0);
  });

  it("normalizes punctuation and spacing without changing the source value", () => {
    expect(normalizeTruthValue("  AI 品牌，增长系统。 ")).toBe("ai 品牌增长系统");
  });
});
