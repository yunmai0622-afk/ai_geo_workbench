import { describe, expect, it } from "vitest";
import {
  evaluateGeoProfileP0Readiness,
  formatGeoProfileIncompleteMessage,
  isP0GeoProfileCompleteFromRecord,
} from "@shared/geoProfileP0Readiness";

const completeProfile = {
  brandName: "测试企业",
  industryTag: "软件",
  oneLiner: "一句话介绍",
  productDesc: "核心产品",
  targetCustomer: "中小企业",
  customerPains: ["获客难"],
  keyPoints: ["交付快"],
  keywords: ["GEO"],
};

describe("geoProfileP0Readiness", () => {
  it("8 项 P0 字段齐全时 complete=true", () => {
    const r = evaluateGeoProfileP0Readiness(completeProfile);
    expect(r.complete).toBe(true);
    expect(r.missingLabels).toEqual([]);
    expect(isP0GeoProfileCompleteFromRecord(completeProfile)).toBe(true);
  });

  it("缺字段时列出缺失项", () => {
    const r = evaluateGeoProfileP0Readiness({ brandName: "仅名称" });
    expect(r.complete).toBe(false);
    expect(r.missingLabels).toContain("所属行业");
    expect(r.missingLabels).toContain("关键词");
  });

  it("formatGeoProfileIncompleteMessage 包含缺失字段", () => {
    const msg = formatGeoProfileIncompleteMessage(["企业名称", "关键词"]);
    expect(msg).toContain("企业名称");
    expect(msg).toContain("关键词");
  });
});
