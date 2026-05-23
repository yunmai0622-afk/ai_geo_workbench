import { describe, expect, it } from "vitest";
import { buildPublishNextActions, computePublishOverview } from "../client/src/lib/assetProgressDisplay";

describe("assetProgressDisplay metrics (C4-B)", () => {
  it("computes publish overview without mock", () => {
    const empty = computePublishOverview([]);
    expect(empty.publishedContentCount).toBeNull();
    const rows = computePublishOverview([
      { articleId: 1, publishChannel: "知乎", publishUrl: "https://a" },
      { articleId: 1, publishChannel: "公众号", publishUrl: "" },
      { articleId: 2, publishChannel: "知乎", publishedAt: Date.now() - 8 * 86400000 },
    ]);
    expect(rows.publishedContentCount).toBe(2);
    expect(rows.platformCount).toBe(2);
    expect(rows.withLinkCount).toBe(1);
  });

  it("builds at most three publish next actions", () => {
    const actions = buildPublishNextActions([{ publishChannel: "知乎" }]);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.length).toBeLessThanOrEqual(3);
  });
});
