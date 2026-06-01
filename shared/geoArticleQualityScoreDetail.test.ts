import { describe, expect, it } from "vitest";
import {
  buildGeoArticleQualityDimensionDisplays,
  formatGeoArticleQualityDimensionLine,
  hasGeoArticleQualityScoreDetail,
} from "./geoArticleQualityScoreDetail";

describe("geoArticleQualityScoreDetail", () => {
  it("maps geo_article_quality_scores columns to five customer-facing dimensions", () => {
    const rows = buildGeoArticleQualityDimensionDisplays({
      originalityScore: 12,
      problemMatchScore: 18,
      evidenceScore: 16,
      structureScore: 14,
      geoCitableScore: 13,
      totalScore: 88,
    });
    expect(rows).toEqual([
      { label: "实体清晰度", score: 12 },
      { label: "场景关联度", score: 18 },
      { label: "证据充分度", score: 16 },
      { label: "结构化程度", score: 14 },
      { label: "可引用性", score: 13 },
    ]);
    expect(formatGeoArticleQualityDimensionLine(rows![0]!)).toBe("实体清晰度：12分");
  });

  it("returns null when any dimension is missing", () => {
    expect(
      buildGeoArticleQualityDimensionDisplays({
        problemMatchScore: 10,
        evidenceScore: 10,
      }),
    ).toBeNull();
    expect(hasGeoArticleQualityScoreDetail(null)).toBe(false);
  });
});
