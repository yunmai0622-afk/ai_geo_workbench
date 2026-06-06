import { describe, expect, it } from "vitest";
import {
  resolveWeeklyAiQcDisplayStatus,
  resolveWeeklyEnqueueButtonKind,
  resolveWeeklyManualReviewDisplayStatus,
  weeklyEnqueueButtonLabel,
} from "./weeklyPublishableDisplay";

describe("weeklyPublishableDisplay", () => {
  it("maps AI QC gate to display status", () => {
    expect(resolveWeeklyAiQcDisplayStatus({ geoQualityRecommendation: "publish", geoQualityScore: 80 })).toBe(
      "通过",
    );
    expect(resolveWeeklyAiQcDisplayStatus({ geoQualityRecommendation: "reject", geoQualityScore: 20 })).toBe(
      "未通过",
    );
    expect(resolveWeeklyAiQcDisplayStatus({})).toBe("未质检");
  });

  it("maps manual review status", () => {
    expect(resolveWeeklyManualReviewDisplayStatus("待审核")).toBe("未审核");
    expect(resolveWeeklyManualReviewDisplayStatus("已审核可发布")).toBe("已审核");
  });

  it("enqueue button kind for pending review", () => {
    const kind = resolveWeeklyEnqueueButtonKind({
      aiQcStatus: "通过",
      manualReviewPending: true,
      publishPreflightReady: true,
    });
    expect(kind).toBe("review_and_enqueue");
    expect(weeklyEnqueueButtonLabel(kind)).toBe("审核并加入队列");
  });

  it("enqueue button kind blocks failed QC", () => {
    const kind = resolveWeeklyEnqueueButtonKind({
      aiQcStatus: "未通过",
      manualReviewPending: true,
      publishPreflightReady: true,
    });
    expect(kind).toBe("blocked_qc");
  });
});
