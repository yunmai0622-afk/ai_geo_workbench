import { describe, expect, it } from "vitest";
import {
  evaluateGeoProfileP0Readiness,
  evaluateProfileReadinessForT0,
  formatGeoProfileIncompleteMessage,
  formatT0ProfileBlockingMessage,
  isP0GeoProfileCompleteFromRecord,
  isProfileCoreAdvantageFilled,
  isProfilePrimaryPainFilled,
  resolveProfileCoreAdvantage,
  resolveProfilePrimaryPain,
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
  it("6 项 P0 必填齐全时 complete=true（pain/advantage 可选）", () => {
    const r = evaluateGeoProfileP0Readiness(completeProfile);
    expect(r.complete).toBe(true);
    expect(r.missingLabels).toEqual([]);
    expect(isP0GeoProfileCompleteFromRecord(completeProfile)).toBe(true);
  });

  it("无 customerPains/keyPoints 仍可 P0 complete", () => {
    const { customerPains: _p, keyPoints: _k, ...base } = completeProfile;
    const r = evaluateGeoProfileP0Readiness(base);
    expect(r.complete).toBe(true);
    expect(r.missingLabels).not.toContain("主要解决的问题");
  });

  it("resolve helpers fall back to oneLiner", () => {
    const profile = { oneLiner: "兜底介绍", customerPains: [], keyPoints: [] };
    expect(resolveProfilePrimaryPain(profile)).toBe("兜底介绍");
    expect(resolveProfileCoreAdvantage(profile)).toBe("兜底介绍");
    expect(isProfilePrimaryPainFilled(profile)).toBe(false);
    expect(isProfileCoreAdvantageFilled(profile)).toBe(false);
  });

  it("T0 不再因 customerPains 空阻断", () => {
    const { customerPains: _p, ...base } = completeProfile;
    const r = evaluateProfileReadinessForT0({
      profile: { ...base, competitors: ["竞品A"] },
    });
    expect(r.ready).toBe(true);
  });

  it("T0 阻断消息不暴露工程字段名", () => {
    expect(formatT0ProfileBlockingMessage(["企业名称"])).toBe(
      "请先完善品牌资产建档中的基础信息，再启动 AI 能见度诊断",
    );
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
