import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Xiaohongshu-Material", () => {
  it("server generates structured xiaohongshu note material", () => {
    const logic = read("server/geoArticleLogic.ts");
    expect(logic).toContain("buildXiaohongshuNoteMaterial");
    expect(logic).toContain("buildXiaohongshuMaterialText");
  });

  it("weekly card and editor expose xiaohongshu material UI", () => {
    const card = read("client/src/components/weekly/WeeklyPlatformArticleCard.tsx");
    const editor = read("client/src/components/ArticleAssetEditorSheet.tsx");
    const component = read("client/src/components/weekly/XiaohongshuMaterialCard.tsx");
    expect(card).toContain("XiaohongshuMaterialCard");
    expect(editor).toContain("XiaohongshuMaterialCard");
    expect(component).toContain("xiaohongshu-material-card");
    expect(component).toContain("xiaohongshu-copy-publish-package");
    expect(component).toContain("一键复制发布包");
  });
});
