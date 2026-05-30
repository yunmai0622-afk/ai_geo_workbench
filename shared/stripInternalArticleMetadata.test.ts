import { describe, expect, it } from "vitest";
import { stripInternalArticleMetadataFromMarkdown } from "./stripInternalArticleMetadata";

describe("stripInternalArticleMetadataFromMarkdown", () => {
  it("removes internal metadata sections but keeps first citable block", () => {
    const input = [
      "# 标题",
      "## 小结",
      "正文小结。",
      "## 便于引用的要点",
      "### 用户问题",
      "用户向答案。",
      "## 更新说明",
      "内部更新。",
      "## 发布后如何自行核对效果",
      "自行核对。",
      "## 便于引用的要点",
      "### 品牌是做什么的",
      "品牌介绍。",
      "## 平台适配说明",
      "平台说明。",
      "## GEO 质量自检说明",
      "自检。",
    ].join("\n");

    const out = stripInternalArticleMetadataFromMarkdown(input);
    expect(out).toContain("## 便于引用的要点");
    expect(out).toContain("### 用户问题");
    expect(out).not.toContain("## 更新说明");
    expect(out).not.toContain("## 发布后如何自行核对效果");
    expect(out).not.toContain("### 品牌是做什么的");
    expect(out).not.toContain("## 平台适配说明");
    expect(out).not.toContain("## GEO 质量自检说明");
  });
});
