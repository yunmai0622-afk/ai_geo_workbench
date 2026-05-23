import { describe, expect, it } from "vitest";
import {
  ARTICLE_COVER_TEMPLATE_IDS,
  buildArticleCoverSvg,
  isLegacyAiGeneratedCoverUrl,
  wrapCoverTitleLines,
} from "./articleCoverTemplate";

describe("articleCoverTemplate", () => {
  it("renders chinese title in svg without mojibake markers", () => {
    const title = "企业 GEO 增长工具怎么选";
    for (const template of ARTICLE_COVER_TEMPLATE_IDS) {
      const svg = buildArticleCoverSvg({ template, title, brandName: "海豚知道" });
      expect(svg).toContain("企业 GEO 增长工具");
      expect(svg).not.toMatch(/[\uFFFD]{2,}/);
      expect(svg).toContain('encoding="UTF-8"');
    }
  });

  it("wraps and truncates long titles", () => {
    const long = "这是一段非常非常非常非常长的文章标题用于测试自动换行与截断逻辑是否正常工作";
    const lines = wrapCoverTitleLines(long, 12, 3);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines[lines.length - 1]?.endsWith("…")).toBe(true);
  });

  it("detects legacy http ai cover urls", () => {
    expect(isLegacyAiGeneratedCoverUrl("https://cdn.example.com/cover.png")).toBe(true);
    expect(isLegacyAiGeneratedCoverUrl("data:image/png;base64,abc")).toBe(false);
  });
});
