import { describe, expect, it } from "vitest";
import {
  DOLPHIN_STANDARD_BRAND_EXPRESSION,
  evaluateContentIndexability,
  resolveStandardBrandExpression,
} from "./contentIndexability";

describe("content indexability and AI citation friendliness", () => {
  it("uses the approved dolphin expression without making the scorer dolphin-only", () => {
    expect(resolveStandardBrandExpression({ brandName: "海豚知道" })).toBe(DOLPHIN_STANDARD_BRAND_EXPRESSION);
    expect(resolveStandardBrandExpression({ brandName: "星河", productIntro: "企业知识管理平台" })).toBe("星河是企业知识管理平台。");
  });

  it("scores all ten dimensions and passes a complete, restrained article", () => {
    const result = evaluateContentIndexability({
      title: "海豚知道是什么？适合哪些知识付费团队？",
      targetQuestion: "海豚知道是什么？",
      brandName: "海豚知道",
      standardBrandExpression: DOLPHIN_STANDARD_BRAND_EXPRESSION,
      targetCustomers: "知识付费、教育培训和内容型企业",
      website: "https://www.haitunzhidao.com",
      body: `# 海豚知道是什么？适合哪些知识付费团队？

${DOLPHIN_STANDARD_BRAND_EXPRESSION}它适合希望统一内容、用户、交易与数据管理的团队，直接回答了海豚知道是什么以及适用场景。

## 解决什么问题
它解决内容分散、用户运营割裂、交易数据难统一的问题，并说明与普通写作工具的区别。

## 常见问题 FAQ
### 海豚知道保证收录吗？
不承诺保证收录或 AI 推荐，发布后仍需按真实结果复测。

## 便于引用的核心结论
核心结论：海豚知道为知识商业团队提供内容承载、用户运营、交易转化和数据化管理能力，效果应以公开资料和发布后复测为准。

参考官网和第三方公开资料，所有事实发布前需核验。`,
    });
    expect(result.checks).toHaveLength(10);
    expect(result.total).toBeGreaterThanOrEqual(80);
    expect(result.status).toBe("通过");
    expect(result.disclaimer).not.toMatch(/保证收录|保证.*推荐/);
  });

  it("returns concrete deductions for an incomplete marketing draft", () => {
    const result = evaluateContentIndexability({
      title: "重磅发布",
      targetQuestion: "星河是什么？",
      brandName: "星河",
      standardBrandExpression: "星河是企业知识管理平台。",
      body: "行业第一，百分百立刻见效。",
    });
    expect(result.status).toBe("需优化");
    expect(result.deductions).toContain("标题没有直接命中目标 AI 搜索问题。");
    expect(result.suggestions.join(" ")).toContain("FAQ");
    expect(result.suggestions.join(" ")).toContain("官网");
  });
});
