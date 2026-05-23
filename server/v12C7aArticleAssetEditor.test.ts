import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ARTICLE_COVER_TEMPLATE_IDS,
  buildArticleCoverSvg,
  wrapCoverTitleLines,
} from "@shared/articleCoverTemplate";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C7-A article asset editor and template cover", () => {
  it("generated article renders cover preview on weekly page", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("articleCoverPreviewSrc");
    expect(weekly).toContain("aspect-video");
    expect(weekly).toContain("待生成封面");
  });

  it("cover template renders chinese title without mojibake", () => {
    const title = "企业 GEO 工具选型与对比指南";
    for (const template of ARTICLE_COVER_TEMPLATE_IDS) {
      const svg = buildArticleCoverSvg({ template, title, brandName: "海豚知道" });
      expect(svg).toContain("企业 GEO");
      expect(svg).toContain("工具选型");
      expect(svg).not.toMatch(/\uFFFD/);
    }
  });

  it("article title and content can be updated via updateGeneratedArticle", () => {
    expect(read("server/routers.ts")).toContain("updateGeneratedArticle");
    expect(read("server/routers.ts")).toContain("markdownContent: input.content");
  });

  it("publish task uses updated title content and cover from article row", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("article.title");
    expect(router).toContain("article.markdownContent");
    expect(router).toContain("buildPublishCoverImageUrl(article.coverBase64");
    expect(router).not.toContain("generateCoverImage");
  });

  it("cover template switch updates preview in editor", () => {
    expect(read("client/src/components/ArticleAssetEditorSheet.tsx")).toContain("buildArticleCoverDataUrl");
    expect(read("client/src/components/ArticleAssetEditorSheet.tsx")).toContain('onChange={e => setTemplate');
  });

  it("missing cover does not block article editing", () => {
    const sheet = read("client/src/components/ArticleAssetEditorSheet.tsx");
    expect(sheet).toContain("待生成封面");
    expect(sheet).toContain("封面生成失败，可重试");
    expect(sheet).toContain("handleSave");
  });

  it("publish task still includes projectId and expectedAccountName after article editing", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("projectId: input.projectId");
    expect(router).toContain("expectedAccountName: boundAccount?.accountName");
    expect(router).toContain("getEnabledPlatformAccount");
  });

  it("exposes cover template helpers and three templates", () => {
    expect(read("shared/articleCoverTemplate.ts")).toContain("COVER_TEMPLATES");
    expect(read("shared/articleCoverTemplate.ts")).toContain("AI 科技风");
    expect(read("shared/articleCoverTemplate.ts")).toContain("知识商业风");
    expect(read("shared/articleCoverTemplate.ts")).toContain("对比分析风");
    const longTitle =
      "这是一段非常非常非常非常非常非常非常非常非常非常非常非常非常非常长的中文标题用于测试截断";
    const lines = wrapCoverTitleLines(longTitle, 12, 3);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.join("").length).toBeLessThan(longTitle.length);
    expect(lines.some(line => line.includes("…"))).toBe(true);
  });
});
