import { describe, expect, it } from "vitest";
import { getContentQualityGateStatus, normalizeGeoQualityFields } from "./contentQualityGate";
import { resolveWeeklyAiQcDisplayStatus } from "./weeklyPublishableDisplay";
import { resolveQualityCardView } from "./geoQualityScoreDisplay";
import { stripInternalArticleMetadataFromMarkdown } from "./stripInternalArticleMetadata";

function probe(label: string, fn: () => unknown) {
  try {
    fn();
    return { label, ok: true as const };
  } catch (e) {
    return { label, ok: false as const, message: e instanceof Error ? e.message : String(e) };
  }
}

describe("contentQualityGate safety", () => {
  it("does not throw on malformed article quality fields", () => {
    const cases = [
      { status: 123 },
      { status: { x: 1 } },
      { lifecycleStatus: 1 },
      { qualityStatus: true },
      { geoQualityRecommendation: 1 },
      { geoQualityScore: "85", geoQualityRecommendation: "publish" },
      { lifecycleEvents: { not: "array" } },
    ] as const;

    const results = cases.map((article, index) =>
      probe(`case-${index}`, () => {
        normalizeGeoQualityFields(article);
        getContentQualityGateStatus(article);
        resolveWeeklyAiQcDisplayStatus(article);
        resolveQualityCardView(article);
      }),
    );

    const failed = results.filter(r => !r.ok);
    expect(failed).toEqual([]);
  });

  it("does not throw when stripping non-string markdown", () => {
    expect(stripInternalArticleMetadataFromMarkdown(999 as unknown as string)).toBe("");
    expect(stripInternalArticleMetadataFromMarkdown(null)).toBe("");
  });
});
