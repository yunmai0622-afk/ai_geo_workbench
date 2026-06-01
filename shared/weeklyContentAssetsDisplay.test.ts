import { describe, expect, it } from "vitest";
import {
  filterWeeklyContentCards,
  resolveArticleCoverPreviewSrc,
  resolveArticlePublishLink,
  resolveContentCardStatus,
  resolveContentTypeLabel,
  sortWeeklyContentCardsByQuality,
} from "./weeklyContentAssetsDisplay";

describe("weeklyContentAssetsDisplay", () => {
  it("resolveContentCardStatus maps publish lifecycle", () => {
    expect(resolveContentCardStatus({ published: true, publishable: true }).filterKey).toBe("published");
    expect(resolveContentCardStatus({ published: false, publishable: true }).label).toBe("可发布");
    expect(resolveContentCardStatus({ published: false, publishable: false }).filterKey).toBe("draft");
  });
  it("resolveContentTypeLabel prefers strategy labels", () => {
    expect(resolveContentTypeLabel({ contentStrategyType: "seeding" })).toContain("种草");
  });
  it("resolveArticleCoverPreviewSrc uses base64 cover", () => {
    expect(resolveArticleCoverPreviewSrc({ coverBase64: "abc123" })).toBe("data:image/png;base64,abc123");
  });
  it("resolveArticlePublishLink prefers publish record url", () => {
    expect(resolveArticlePublishLink({ articleId: 7, publishRecords: [{ articleId: 7, publishUrl: "https://example.com/post" }] })).toBe("https://example.com/post");
  });
  it("filterWeeklyContentCards filters platform and status", () => {
    const cards = [
      { id: 1, platformKey: "zhihu", statusFilterKey: "publishable" as const },
      { id: 2, platformKey: "xiaohongshu", statusFilterKey: "draft" as const },
    ];
    expect(filterWeeklyContentCards(cards, { platform: "zhihu", status: "all" })).toHaveLength(1);
  });
  it("sortWeeklyContentCardsByQuality orders by score", () => {
    const cards = [
      { id: 1, statusFilterKey: "draft" as const, qualityScore: 60 },
      { id: 2, statusFilterKey: "draft" as const, qualityScore: 90 },
    ];
    expect(sortWeeklyContentCardsByQuality(cards, "desc").map(c => c.id)).toEqual([2, 1]);
  });
});
