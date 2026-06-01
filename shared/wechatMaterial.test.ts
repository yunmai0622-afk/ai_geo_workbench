import { describe, expect, it } from "vitest";
import {
  buildWechatMaterialFromInputs,
  buildWechatMaterialText,
  clampWechatSummary,
  formatWechatBodyFromMarkdown,
  parseWechatMaterial,
  resolveWechatMaterial,
  WECHAT_SUMMARY_MAX_LEN,
} from "./wechatMaterial";

describe("wechatMaterial", () => {
  it("clamps summary to 100 characters", () => {
    const long = "这是一段超过一百字限制的摘要内容需要被截断处理这是一段超过一百字限制的摘要内容需要被截断处理这是一段超过一百字限制的摘要内容需要被截断处理";
    expect(Array.from(clampWechatSummary(long)).length).toBeLessThanOrEqual(WECHAT_SUMMARY_MAX_LEN);
  });

  it("formats body with paragraph spacing for wechat", () => {
    const body = formatWechatBodyFromMarkdown("# 重复标题\n\n## 背景\n\n第一段说明。\n\n- 要点一\n- 要点二");
    expect(body).not.toMatch(/^#\s/m);
    expect(body).toContain("背景");
    expect(body).toContain("· 要点一");
  });

  it("round-trips structured material text", () => {
    const view = buildWechatMaterialFromInputs({
      title: "GEO 内容如何被 AI 引用",
      markdownContent: "## 背景\n\n许多团队忽视结构化内容。\n\n## 方法\n\n- 补 FAQ\n- 补案例",
      generationBasis: { customerQuestion: "AI 如何引用企业内容？" },
    });
    const raw = buildWechatMaterialText(view);
    const parsed = parseWechatMaterial(raw);
    expect(parsed?.articleTitle).toBe(view.articleTitle);
    expect(parsed?.summary.length).toBeLessThanOrEqual(WECHAT_SUMMARY_MAX_LEN);
    expect(parsed?.bodyDisplay).toContain("背景");
    expect(parsed?.coverSizeHint).toContain("900");
  });

  it("resolves legacy 公众号长文版 with ## 正文", () => {
    const legacy = `# 测试标题

这是摘要段落，说明文章价值。

## 正文

## 小节

正文第一段。

## 给编辑的说明

请核对。`;
    const view = resolveWechatMaterial({
      materialText: legacy,
      title: "测试标题",
      markdownContent: "",
    });
    expect(view.articleTitle).toBe("测试标题");
    expect(view.summary).toContain("摘要");
    expect(view.bodyDisplay).toContain("小节");
  });
});
