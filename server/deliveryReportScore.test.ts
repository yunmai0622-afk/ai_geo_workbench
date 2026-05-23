import { describe, expect, it } from "vitest";
import {
  buildDeliveryReportConclusionLine,
  buildHeroSummaryLine,
  buildReportSummaryLines,
} from "../client/src/lib/deliveryReportDisplay";
import {
  DELIVERY_REPORT_SCORE_MISSING_LABEL,
  formatDeliveryReportVisibilityScore,
  resolveDeliveryReportVisibilityScore,
} from "../shared/deliveryReportScore";

describe("delivery report visibility score consistency (C5-Hotfix)", () => {
  it("delivery report uses consistent visibility score from totalScore only", () => {
    const score = { totalScore: 40, aiVisibilityScore: 100, aiRecommendationScore: 20 };
    expect(resolveDeliveryReportVisibilityScore(score)).toBe(40);
    expect(resolveDeliveryReportVisibilityScore({ aiVisibilityScore: 100 })).toBeNull();
  });

  it("public report uses same score in hero and summary", () => {
    const visibilityScore = 40;
    const conclusionLine = buildDeliveryReportConclusionLine(visibilityScore, true);
    expect(conclusionLine).toContain("40 分");
    expect(buildHeroSummaryLine(conclusionLine, visibilityScore)).toContain("40 分");
    const summary = buildReportSummaryLines({
      publishCount: 1,
      questionCount: 3,
      engineCount: 2,
      mentionRate: 0.2,
      recommendRate: 0.1,
      hasAiTestData: true,
      visibilityScore,
    });
    expect(summary[1]).toContain("40 分");
  });

  it("no hardcoded 100 score fallback when actual totalScore is lower", () => {
    const visibilityScore = resolveDeliveryReportVisibilityScore({ totalScore: 40, aiVisibilityScore: 100 });
    expect(visibilityScore).toBe(40);
    expect(formatDeliveryReportVisibilityScore(visibilityScore)).toBe("40");
    expect(formatDeliveryReportVisibilityScore(visibilityScore)).not.toBe("100");
  });

  it("missing score renders 暂无数据", () => {
    expect(resolveDeliveryReportVisibilityScore(null)).toBeNull();
    expect(formatDeliveryReportVisibilityScore(null)).toBe(DELIVERY_REPORT_SCORE_MISSING_LABEL);
    const summary = buildReportSummaryLines({
      publishCount: 0,
      questionCount: 0,
      engineCount: 0,
      mentionRate: 0,
      recommendRate: 0,
      hasAiTestData: false,
      visibilityScore: null,
    });
    expect(summary.every(line => !line.includes("100 分"))).toBe(true);
  });
});
