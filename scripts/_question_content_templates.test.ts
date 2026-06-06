import { describe, expect, it } from "vitest";
import { BUILTIN_QUESTION_TEMPLATES, buildQuestionTemplateVariables, fillQuestionTemplatePrompt } from "./questionContentTemplates";
import { fillTemplateWithProjectProfile, isLikelyGeoSystemProductCopy, resolveQuestionTemplatePreviewProfile } from "./templateProjectProfileFill";

const dolphin = { brandName: "海豚知道", productDesc: "帮助知识主播变现的经营系统", targetCustomer: "知识主播", keyPoints: ["AI经营系统"] };
const geoProject = { enterpriseName: "海豚知道", productIntro: "GEO 诊断、内容生成、质量评分与发布检查", targetCustomers: "希望通过 AI 搜索获得稳定曝光的 B2B 企业" };

describe("questionContentTemplates", () => {
  it("has builtin templates", () => { expect(BUILTIN_QUESTION_TEMPLATES.length).toBeGreaterThan(0); });
  it("fills explicit placeholders", () => {
    expect(fillQuestionTemplatePrompt("{brand}", buildQuestionTemplateVariables({ brand: "A", product: "B", targetCustomer: "C", industry: "D", coreAdvantage: "E" }))).toContain("A");
  });
  it("marks missing fields", () => {
    const p = fillTemplateWithProjectProfile("{brand}{product}", { project: { enterpriseName: "测试" } });
    expect(p.filledPrompt).toContain("【缺少：核心产品/服务】");
  });
  it("prefers profile over geo junk project row", () => {
    const p = fillTemplateWithProjectProfile("{brand}{product}{targetCustomer}", { project: geoProject, profile: dolphin });
    expect(p.filledPrompt).toContain("知识主播");
    expect(p.filledPrompt).not.toContain("GEO 诊断");
  });
  it("isolates projects", () => {
    expect(fillTemplateWithProjectProfile("{brand}", { profile: { brandName: "甲" } }).filledPrompt).toContain("甲");
    expect(fillTemplateWithProjectProfile("{brand}", { profile: { brandName: "乙" } }).filledPrompt).not.toContain("甲");
  });
  it("detects geo marketing copy", () => { expect(isLikelyGeoSystemProductCopy("GEO 诊断、内容生成、质量评分与发布检查")).toBe(true); });
  it("dolphin directions", () => {
    const r = resolveQuestionTemplatePreviewProfile({ profile: dolphin });
    expect(Object.values(r.rawVariables).join(" ")).toMatch(/知识主播|AI经营/);
  });
});
