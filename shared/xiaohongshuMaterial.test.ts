import { describe, expect, it } from "vitest";
import {
  buildXiaohongshuMaterialFromInputs,
  buildXiaohongshuMaterialText,
  buildXiaohongshuPublishPackage,
  clampXiaohongshuNoteTitle,
  parseXiaohongshuMaterial,
  resolveXiaohongshuMaterial,
  XIAOHONGSHU_NOTE_TITLE_MAX_LEN,
} from "./xiaohongshuMaterial";

describe("xiaohongshuMaterial", () => {
  it("clamps note title to 25 characters", () => {
    const long = "这是一段超过二十五字限制的笔记标题需要被截断处理";
    expect(Array.from(clampXiaohongshuNoteTitle(long)).length).toBeLessThanOrEqual(XIAOHONGSHU_NOTE_TITLE_MAX_LEN);
  });

  it("round-trips structured material text", () => {
    const view = buildXiaohongshuMaterialFromInputs({
      title: "知识付费怎么做GEO",
      markdownContent: "## 痛点\n\n很多团队不会写可被 AI 引用的内容。\n\n## 步骤\n\n- 先补 FAQ\n- 再补案例",
      industry: "知识付费",
      enterpriseName: "示例品牌",
    });
    const raw = buildXiaohongshuMaterialText(view);
    const parsed = parseXiaohongshuMaterial(raw);
    expect(parsed?.noteTitle).toBe(view.noteTitle);
    expect(parsed?.body).toContain("😣");
    expect(parsed?.imageSuggestions.length).toBeGreaterThan(0);
    expect(parsed?.hashtags.some(t => t.includes("知识付费"))).toBe(true);
  });

  it("builds publish package as title + body + hashtags", () => {
    const view = buildXiaohongshuMaterialFromInputs({
      title: "测试标题",
      markdownContent: "## 结论\n\n先给结论。",
    });
    const pkg = buildXiaohongshuPublishPackage(view);
    expect(pkg.startsWith(view.noteTitle)).toBe(true);
    expect(pkg).toContain("#知识付费");
    expect(pkg).toContain("✅");
  });

  it("resolves legacy plain material", () => {
    const legacy = "老标题\n\n适合人群：团队\n\n核心发现：需要补证据";
    const view = resolveXiaohongshuMaterial({
      materialText: legacy,
      title: "备用标题",
      markdownContent: "## 痛点\n\n说明",
    });
    expect(view.noteTitle).toBe("老标题");
    expect(view.body.length).toBeGreaterThan(0);
    expect(view.hashtags.length).toBeGreaterThan(0);
  });
});
