import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.3-WeeklyFix-P0", () => {
  const detailSheet = read("client/src/components/weekly/WeeklyContentDetailSheet.tsx");
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const editor = read("client/src/components/ArticleAssetEditorSheet.tsx");
  const platform = read("shared/articlePublishPlatform.ts");

  it("detail sheet exposes cover generate and upload entry when missing", () => {
    expect(detailSheet).toContain("weekly-detail-generate-cover");
    expect(detailSheet).toContain("生成封面图");
    expect(detailSheet).toContain("weekly-detail-upload-cover");
    expect(detailSheet).toContain("上传封面图");
  });

  it("weekly page wires cover handlers into detail sheet", () => {
    expect(weekly).toContain("handleRegenerateCover");
    expect(weekly).toContain("handleUploadCover");
    expect(weekly).toContain("onGenerateCover");
    expect(weekly).toContain("onUploadCover");
  });

  it("editor shows generate cover label when no cover yet", () => {
    expect(editor).toContain("article-asset-generate-cover-button");
    expect(editor).toContain("生成封面图");
  });

  it("platform resolver prefers specific labels before generic 公众号", () => {
    expect(platform).toContain("PLATFORM_LABEL_MATCH_ORDER");
    expect(platform).toContain("inferPlatformFromThirdPartyMaterials");
    expect(platform).toContain("thirdPartyMaterials");
  });

  it("detail sheet exposes recheck quality button when qc failed", () => {
    expect(detailSheet).toContain("weekly-detail-recheck-quality");
    expect(detailSheet).toContain("重新质检");
    expect(detailSheet).toContain("contentQualityReview");
    expect(detailSheet).toContain("weekly-detail-ai-qc-hint");
    expect(weekly).toContain("onQualityReviewed");
  });

  it("detail sheet renders quality score without nested popover", () => {
    expect(detailSheet).toContain("weekly-detail-quality-");
    expect(detailSheet).not.toContain("GeoArticleQualityScoreDetailPopover");
  });
});
