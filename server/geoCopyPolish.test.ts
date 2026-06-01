import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Copy-Polish", () => {
  it("content editor sheet supports one-click body copy with copied feedback", () => {
    const sheet = read("client/src/components/ArticleAssetEditorSheet.tsx");
    expect(sheet).toContain("一键复制正文");
    expect(sheet).toContain('bodyCopied ? "已复制" : "一键复制正文"');
    expect(sheet).toContain("article-copy-body-button");
    expect(sheet).toContain("navigator.clipboard.writeText");
  });

  it("weekly publish content cards expose body copy with copied feedback", () => {
    const card = read("client/src/components/weekly/WeeklyPlatformArticleCard.tsx");
    expect(card).toContain("复制正文");
    expect(card).toContain('bodyCopied ? "已复制" : "复制正文"');
    expect(card).toContain("weekly-card-copy-body-");
    expect(card).toContain("stripInternalArticleMetadataFromMarkdown");
  });
});
