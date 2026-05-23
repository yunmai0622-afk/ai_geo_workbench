import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  GEO_QUALITY_STALE_EDITOR_HINT,
  GEO_QUALITY_STALE_PUBLISH_HINT,
  isGeoQualityScoreStale,
  shouldBlockPublishForGeoQuality,
} from "@shared/geoQualityStale";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C8-A-Fix geo quality stale", () => {
  it("updateGeneratedArticle marks quality score stale after title change", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("geoQualityStale: 1");
    expect(router).toContain("input.title !== article.title");
  });

  it("updateGeneratedArticle marks quality score stale after content change", () => {
    expect(read("server/routers.ts")).toContain("input.content !== article.markdownContent");
  });

  it("contentQualityReview clears stale flag", () => {
    expect(read("server/geoQualityReviewService.ts")).toContain("geoQualityStale: 0");
  });

  it("stale score shows warning in GeoQualityScore", () => {
    const geo = read("client/src/components/GeoQualityScore.tsx");
    expect(geo).toContain("GEO_QUALITY_STALE_EDITOR_HINT");
    expect(geo).toContain("geo-quality-stale-hint");
    expect(GEO_QUALITY_STALE_EDITOR_HINT).toContain("内容已修改");
  });

  it("stale score does not block publish", () => {
    expect(
      shouldBlockPublishForGeoQuality({
        geoQualityScore: 50,
        geoQualityRecommendation: "reject",
        geoQualityStale: true,
      }),
    ).toBe(false);
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("GEO_QUALITY_STALE_PUBLISH_HINT");
    expect(GEO_QUALITY_STALE_PUBLISH_HINT).toContain("建议重新质检");
  });

  it("reject score still blocks publish when not stale", () => {
    expect(
      shouldBlockPublishForGeoQuality({
        geoQualityScore: 50,
        geoQualityRecommendation: "reject",
        geoQualityStale: false,
      }),
    ).toBe(true);
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("blockPublishIfQualityReject");
  });

  it("unsaved changes still block before quality checks", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    const openFn = weekly.slice(weekly.indexOf("const openPublishDialog"));
    const unsavedCall = openFn.indexOf("blockPublishIfUnsaved(article.id)");
    const rejectCall = openFn.indexOf("blockPublishIfQualityReject(article)");
    expect(unsavedCall).toBeGreaterThan(-1);
    expect(rejectCall).toBeGreaterThan(-1);
    expect(unsavedCall).toBeLessThan(rejectCall);
  });

  it("isGeoQualityScoreStale requires existing score", () => {
    expect(isGeoQualityScoreStale({ geoQualityStale: true })).toBe(false);
    expect(isGeoQualityScoreStale({ geoQualityScore: 80, geoQualityStale: true })).toBe(true);
  });
});
