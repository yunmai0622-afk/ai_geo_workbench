import { describe, expect, it } from "vitest";
import {
  aggregateContentAssetEffectOverview,
  aggregatePlatformEffectSummary,
  buildContentAssetNextAction,
  computeCanEnterAiRetest,
  daysUntilAiRetest,
  effectInclusionStatusLabelCn,
  normalizeEffectInclusionStatus,
} from "./contentAssetEffectTracking";

describe("contentAssetEffectTracking", () => {
  it("maps inclusion status to customer labels", () => {
    expect(effectInclusionStatusLabelCn("pending")).toBe("待收录");
    expect(effectInclusionStatusLabelCn("included")).toBe("已收录");
    expect(effectInclusionStatusLabelCn("failed")).toBe("收录失败");
    expect(effectInclusionStatusLabelCn("unverified")).toBe("未验证");
    expect(normalizeEffectInclusionStatus(null)).toBe("pending");
  });

  it("computes canEnterAiRetest after 3 days", () => {
    const now = new Date("2026-06-10T12:00:00Z");
    const verifiedAt = new Date("2026-06-06T12:00:00Z");
    expect(
      computeCanEnterAiRetest({
        effectInclusionStatus: "included",
        inclusionVerifiedAt: verifiedAt,
        now,
      }),
    ).toBe(true);
    expect(
      computeCanEnterAiRetest({
        effectInclusionStatus: "included",
        inclusionVerifiedAt: new Date("2026-06-09T12:00:00Z"),
        now,
      }),
    ).toBe(false);
    expect(daysUntilAiRetest({
      effectInclusionStatus: "included",
      inclusionVerifiedAt: new Date("2026-06-09T12:00:00Z"),
      now,
    })).toBe(2);
  });

  it("aggregates overview metrics", () => {
    const overview = aggregateContentAssetEffectOverview(4, [
      { id: 1, effectInclusionStatus: "included", readCount: 10, impressionCount: 100 },
      { id: 2, effectInclusionStatus: "included", readCount: 5 },
      { id: 3, effectInclusionStatus: "pending" },
      { id: 4, effectInclusionStatus: "failed" },
    ]);
    expect(overview.publishedCount).toBe(4);
    expect(overview.includedCount).toBe(2);
    expect(overview.inclusionRate).toBe(50);
    expect(overview.pendingCount).toBe(1);
    expect(overview.totalReadCount).toBe(15);
    expect(overview.totalImpressionCount).toBe(100);
  });

  it("aggregates platform summary", () => {
    const rows = aggregatePlatformEffectSummary([
      { id: 1, publishChannel: "知乎", effectInclusionStatus: "included", readCount: 20 },
      { id: 2, publishChannel: "知乎", effectInclusionStatus: "pending", readCount: 5 },
      { id: 3, publishChannel: "百家号", effectInclusionStatus: "included" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.platform).toBe("知乎");
    expect(rows[0]?.includedCount).toBe(1);
    expect(rows[0]?.inclusionRate).toBe(50);
    expect(rows[0]?.totalReadCount).toBe(25);
  });

  it("builds next action by status", () => {
    expect(buildContentAssetNextAction({ effectInclusionStatus: "pending" }).label).toBe("标记为已收录");
    expect(
      buildContentAssetNextAction({
        effectInclusionStatus: "included",
        inclusionVerifiedAt: new Date("2020-01-01"),
      }).kind,
    ).toBe("join_retest");
    expect(buildContentAssetNextAction({ effectInclusionStatus: "failed" }).label).toBe("重新发布");
  });
});
