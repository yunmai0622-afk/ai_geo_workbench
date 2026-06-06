import { describe, expect, it } from "vitest";
import { buildQuestionTemplatePreview } from "./questionTemplateService";

const template = { id: 1, title: "t", platform: "zhihu", questionType: "品牌认知", promptTemplate: "{brand}核心{product}服务{targetCustomer}" };
const dolphin = { brandName: "海豚知道", productDesc: "知识付费 SaaS 与 AI 经营系统", targetCustomer: "知识主播" };
const geoProject = { enterpriseName: "海豚知道", productIntro: "GEO 诊断、内容生成、质量评分与发布检查", targetCustomers: "B2B 企业" };

describe("question template preview", () => {
  it("uses profile for project", () => {
    const p = buildQuestionTemplatePreview(template, geoProject, dolphin);
    expect(p.filledPrompt).toContain("知识付费");
    expect(p.filledPrompt).not.toContain("GEO 诊断");
  });
  it("isolates brands", () => {
    const a = buildQuestionTemplatePreview(template, { enterpriseName: "甲" }, { brandName: "甲", productDesc: "甲产品" });
    const b = buildQuestionTemplatePreview(template, { enterpriseName: "乙" }, { brandName: "乙", productDesc: "乙产品" });
    expect(a.filledPrompt).not.toContain("乙");
  });
  it("missing fields", () => {
    const p = buildQuestionTemplatePreview(template, { enterpriseName: "仅名称" }, { brandName: "仅名称" });
    expect(p.filledPrompt).toContain("【缺少：");
  });
});
