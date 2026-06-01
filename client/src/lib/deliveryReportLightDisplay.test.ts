import { describe, expect, it } from "vitest";
import {
  buildDisplayReportNumber,
  buildPublishRetestHeroContent,
  formatBaselinePercent,
  formatMentionRateDeltaPoints,
  mentionRateNarrative,
  resolveVisibilityScoreTier,
} from "./deliveryReportLightDisplay";
import type { AiTestEvidenceAggregate } from "@shared/aiTestEvidence";

const emptyStage = {
  hasData: false,
  questionCount: 0,
  mentionRate: null,
  recommendRate: null,
  averageRank: null,
  citedUrlCount: null,
};

function makeCompare(
  partial: Partial<AiTestEvidenceAggregate["publishCompare"]>,
): AiTestEvidenceAggregate["publishCompare"] {
  return {
    before: emptyStage,
    after: emptyStage,
    changes: {
      mentionRateDelta: null,
      recommendRateDelta: null,
      averageRankDelta: null,
      citedUrlCountDelta: null,
    },
    hasAnyStageData: false,
    ...partial,
  };
}

describe("deliveryReportLightDisplay", () => {
  it("builds display report number from projectId and date", () => {
    const n = buildDisplayReportNumber({
      projectId: 72,
      reportGeneratedAt: new Date("2026-05-22T10:00:00"),
    });
    expect(n).toBe("GEO-202605-072");
  });

  it("formats zero mention as baseline", () => {
    expect(formatBaselinePercent(0, true)).toBe("基线阶段（0%）");
    expect(mentionRateNarrative(0, true)).toContain("基线阶段");
  });

  it("resolves score tiers", () => {
    expect(resolveVisibilityScoreTier(20).label).toBe("起步阶段");
    expect(resolveVisibilityScoreTier(50).label).toBe("初步可见");
    expect(resolveVisibilityScoreTier(70).label).toBe("部分可见");
    expect(resolveVisibilityScoreTier(90).label).toBe("稳定可见");
  });

  it("builds retest hero comparison when T1 after-publish data exists", () => {
    const content = buildPublishRetestHeroContent(
      makeCompare({
        before: { ...emptyStage, hasData: true, mentionRate: 0 },
        after: { ...emptyStage, hasData: true, mentionRate: 0.12 },
        changes: { ...makeCompare({}).changes, mentionRateDelta: 0.12 },
      }),
    );
    expect(content).toEqual({ kind: "comparison", beforePct: 0, afterPct: 12, deltaPoints: 12 });
  });

  it("builds retest hero waiting state without T1", () => {
    const content = buildPublishRetestHeroContent(
      makeCompare({
        before: { ...emptyStage, hasData: true, mentionRate: 0 },
      }),
    );
    expect(content).toEqual({ kind: "waiting_t1", t0BaselinePct: 0 });
  });

  it("formats mention rate delta in 个百分点", () => {
    expect(formatMentionRateDeltaPoints(0.12)).toBe("+12个百分点");
    expect(formatMentionRateDeltaPoints(-0.05)).toBe("-5个百分点");
    expect(formatMentionRateDeltaPoints(0)).toBe("持平");
  });
});
