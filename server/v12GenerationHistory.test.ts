import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Generation-History", () => {
  it("shared history builder and API endpoints exist", () => {
    expect(read("shared/geoArticleGenerationHistory.ts")).toContain("buildGeoArticleGenerationHistory");
    const routers = read("server/routers.ts");
    expect(routers).toContain("generationHistory:");
    expect(routers).toContain("restoreGenerationHistory:");
    expect(routers).toContain('source: "geo_articles"');
    expect(routers).toContain("optimizationVersions");
    expect(routers).toContain("priorGenerations");
  });

  it("article asset editor shows generation history panel", () => {
    const sheet = read("client/src/components/ArticleAssetEditorSheet.tsx");
    expect(sheet).toContain("ArticleGenerationHistoryPanel");
    expect(read("client/src/components/ArticleGenerationHistoryPanel.tsx")).toContain(
      "article-generation-history",
    );
    expect(read("client/src/components/ArticleGenerationHistoryPanel.tsx")).toContain("restoreGenerationHistory");
  });
});
