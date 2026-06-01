import { describe, expect, it } from "vitest";
import { BUILTIN_QUESTION_TEMPLATES, buildQuestionTemplateVariables, fillQuestionTemplatePrompt } from "./questionContentTemplates";
describe("questionContentTemplates", () => {
  it("includes zhihu and sohu templates", () => {
    expect(BUILTIN_QUESTION_TEMPLATES.some(t => t.slug === "zhihu-brand-awareness")).toBe(true);
    expect(BUILTIN_QUESTION_TEMPLATES.some(t => t.slug === "sohu-industry-intro")).toBe(true);
  });
  it("fills placeholders", () => {
    const filled = fillQuestionTemplatePrompt("{brand}是做什么的？核心产品是{product}，主要服务{targetCustomer}", buildQuestionTemplateVariables({ brand: "A", product: "B", targetCustomer: "C", industry: "D", coreAdvantage: "E" }));
    expect(filled).toContain("A");
  });
});
