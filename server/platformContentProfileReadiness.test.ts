import { describe, expect, it } from "vitest";
import { buildDefaultPlatformStrategy } from "@shared/platformContentRules";
import {
  evaluateEnterpriseProfileReadiness,
  formatEnterpriseProfileMissingError,
  isMeaningfulProfileText,
} from "@shared/platformContentProfileReadiness";
import { toPlatformContentGenerationError } from "@shared/platformContentGenerationErrors";
import { assertEnterpriseProfileForPlatformGeneration } from "./platformContentGenerationPreconditions";
import { mergeProjectWithEnterpriseProfile, type P11ProjectLike } from "./geoArticleLogic";

const dolphinProfile = {
  brandName: "海豚知道",
  enterpriseName: "海豚知道",
  industryTag: "知识付费 / 教育培训",
  oneLiner: "帮助知识主播变现的经营系统",
  productDesc: "帮助知识主播变现的经营系统",
  productServiceIntro: "帮助知识主播变现的经营系统",
  targetCustomer: "知识主播",
  customerPains: ["SaaS工具 + AI经营系统"],
  keyPoints: ["AI经营系统"],
  keywords: ["知识付费", "AI经营系统", "知识付费SaaS平台"],
};

const emptyProject: P11ProjectLike = {
  id: 1,
  enterpriseName: "",
  industry: "",
  website: "",
  region: "中国",
  productIntro: "",
  targetCustomers: "",
  coreSellingPoints: "",
  competitorNames: [],
  coreKeywords: [],
};

describe("platform content profile readiness (P0)", () => {
  it("treats screenshot dolphin profile as ready for platform generation", () => {
    const strategy = buildDefaultPlatformStrategy({
      targetQuestion: "知识付费平台怎么选？",
    });
    const result = evaluateEnterpriseProfileReadiness({
      project: emptyProject,
      profile: dolphinProfile,
      platformStrategy: strategy,
    });
    expect(result.ready).toBe(true);
    expect(result.missingLabels).toEqual([]);
    expect(() =>
      assertEnterpriseProfileForPlatformGeneration(emptyProject, { profile: dolphinProfile }, strategy),
    ).not.toThrow();
  });

  it("accepts oneLiner as product service when productDesc empty", () => {
    const result = evaluateEnterpriseProfileReadiness({
      project: emptyProject,
      profile: {
        brandName: "海豚知道",
        oneLiner: "帮助知识主播变现的经营系统",
        targetCustomer: "知识主播",
      },
      platformStrategy: buildDefaultPlatformStrategy({ targetQuestion: "如何选型？" }),
    });
    expect(result.ready).toBe(true);
    expect(result.resolved.productService).toContain("知识主播");
  });

  it("reports specific missing labels", () => {
    const msg = formatEnterpriseProfileMissingError(["产品服务", "目标问题"]);
    expect(msg).toBe("企业资料还缺少：产品服务、目标问题。请先完善后再生成。");
    expect(() =>
      assertEnterpriseProfileForPlatformGeneration(emptyProject, { profile: { brandName: "仅名称" } }, buildDefaultPlatformStrategy()),
    ).toThrow(/企业资料还缺少/);
  });

  it("maps generation basis errors to specific missing labels", () => {
    expect(toPlatformContentGenerationError("缺少生成依据：竞品差距")).toContain("生成依据还缺少");
    expect(toPlatformContentGenerationError("缺少生成依据：竞品差距")).not.toContain("AI 内容诊断并生成优化任务");
  });

  it("mergeProjectWithEnterpriseProfile fills projects row from profile", () => {
    const merged = mergeProjectWithEnterpriseProfile(emptyProject, dolphinProfile);
    expect(merged.enterpriseName).toBe("海豚知道");
    expect(merged.productIntro).toContain("知识主播");
    expect(merged.targetCustomers).toBe("知识主播");
  });

  it("rejects placeholder-only values", () => {
    expect(isMeaningfulProfileText("待补充")).toBe(false);
    expect(isMeaningfulProfileText("帮助知识主播变现的经营系统")).toBe(true);
  });
});
