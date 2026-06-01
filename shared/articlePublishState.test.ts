import { describe, expect, it } from "vitest";
import { formatArticlePublishedAtSentence, resolveArticlePublishedAtForDisplay } from "./articlePublishState";

describe("articlePublishState", () => {
  it("formats published-at sentence for content cards", () => {
    const label = formatArticlePublishedAtSentence(new Date("2026-06-01T08:30:00+08:00"));
    expect(label).toMatch(/^已发布于/);
    expect(label).toContain("2026");
  });

  it("prefers geo_articles.publishedAt over publish record time", () => {
    const resolved = resolveArticlePublishedAtForDisplay({
      publishedAt: "2026-06-02T10:00:00.000Z",
      lastPublishRecordAt: "2026-06-01T08:00:00.000Z",
    });
    expect(resolved?.toISOString()).toBe("2026-06-02T10:00:00.000Z");
  });
});
