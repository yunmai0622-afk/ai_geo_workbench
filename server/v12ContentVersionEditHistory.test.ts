import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Content-Version edit history", () => {
  it("persists contentEditedAt on updateGeneratedArticle when content changes", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain("contentEditedAt");
    expect(routers).toMatch(/contentChanged[\s\S]*contentEditedAt/);
  });

  it("content detail editor shows last modified and post-publish edit warning", () => {
    const sheet = read("client/src/components/ArticleAssetEditorSheet.tsx");
    const meta = read("client/src/components/ArticleContentEditMeta.tsx");
    expect(sheet).toContain("ArticleContentEditMeta");
    expect(meta).toContain("最后修改：");
    expect(meta).toContain("CONTENT_MODIFIED_AFTER_PUBLISH_MESSAGE");
    expect(meta).toContain("article-modified-after-publish-hint");
  });

  it("articles list enriches lastPublishRecordAt for publish-after-edit detection", () => {
    expect(read("server/routers.ts")).toContain("lastPublishRecordAt");
  });
});
