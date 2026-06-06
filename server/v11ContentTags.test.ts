import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("GEO-V1.1-Content-Tags", () => {
  it("schema and shared helpers", () => {
    expect(read("drizzle/schema.ts")).toContain('contentTags: json("contentTags")');
    expect(read("shared/geoArticleContentTags.ts")).toContain("normalizeContentTags");
    expect(read("shared/geoArticleContentTags.ts")).toContain("computeContentTagStats");
  });

  it("router endpoints and weekly UI", () => {
    expect(read("server/routers.ts")).toContain("updateContentTags:");
    expect(read("server/routers.ts")).toContain("contentTagStats:");
    expect(read("client/src/components/ArticleAssetEditorSheet.tsx")).toContain("article-content-tags");
  });
});
