import { describe, expect, it } from "vitest";
import {
  buildContentAssetLifecycleProgressLabels,
  pickLaggingContentAssetLifecycleStage,
  resolveContentAssetLifecycleStage,
} from "./contentAssetLifecycle";

const baseArticle = {
  status: "已生成",
  geoQualityScore: null,
  geoQualityRecommendation: null,
};

describe("resolveContentAssetLifecycleStage", () => {
  it("returns not_started when no article exists", () => {
    const view = resolveContentAssetLifecycleStage({});
    expect(view.stage).toBe("not_started");
    expect(view.label).toBe("待生成");
  });

  it("returns generated when article exists without qc requirement", () => {
    const view = resolveContentAssetLifecycleStage({ article: baseArticle });
    expect(view.stage).toBe("generated");
    expect(view.label).toBe("已生成");
  });

  it("returns pending_review when qc is missing", () => {
    const view = resolveContentAssetLifecycleStage({
      article: { ...baseArticle, status: "待质检" },
    });
    expect(view.stage).toBe("pending_review");
    expect(view.label).toBe("待质检");
  });

  it("returns review_passed when qc passed", () => {
    const view = resolveContentAssetLifecycleStage({
      article: {
        status: "质检通过",
        geoQualityScore: 82,
        geoQualityRecommendation: "publish",
      },
    });
    expect(view.stage).toBe("review_passed");
    expect(view.label).toBe("质检通过");
  });

  it("returns queued when publish task is active", () => {
    const view = resolveContentAssetLifecycleStage({
      article: {
        status: "质检通过",
        geoQualityScore: 82,
        geoQualityRecommendation: "publish",
      },
      publishTask: { status: "pending" },
    });
    expect(view.stage).toBe("queued");
    expect(view.label).toBe("已入队");
  });

  it("returns published when article is published without monitoring record", () => {
    const view = resolveContentAssetLifecycleStage({
      article: { status: "已发布" },
    });
    expect(view.stage).toBe("published");
    expect(view.label).toBe("已发布");
  });

  it("returns pending_inclusion when publish link exists but inclusion is pending", () => {
    const view = resolveContentAssetLifecycleStage({
      article: { status: "已发布" },
      publishRecord: { publishUrl: "https://example.com/post" },
      inclusionRecord: { effectInclusionStatus: "pending" },
    });
    expect(view.stage).toBe("pending_inclusion");
    expect(view.label).toBe("待收录");
  });

  it("returns included when effect status is included", () => {
    const view = resolveContentAssetLifecycleStage({
      article: { status: "已发布" },
      publishRecord: { publishUrl: "https://example.com/post" },
      inclusionRecord: {
        effectInclusionStatus: "included",
        inclusionVerifiedAt: "2026-06-20T00:00:00.000Z",
      },
      now: new Date("2026-06-21T00:00:00.000Z"),
    });
    expect(view.stage).toBe("included");
    expect(view.label).toBe("已收录");
  });

  it("returns has_exposure when read or impression count is positive", () => {
    const view = resolveContentAssetLifecycleStage({
      article: { status: "已发布" },
      publishRecord: { publishUrl: "https://example.com/post" },
      inclusionRecord: {
        effectInclusionStatus: "included",
        inclusionVerifiedAt: "2026-06-20T00:00:00.000Z",
        readCount: 12,
      },
      now: new Date("2026-06-21T00:00:00.000Z"),
    });
    expect(view.stage).toBe("has_exposure");
    expect(view.label).toBe("有曝光");
  });

  it("returns can_retest after 3 days since inclusion verified", () => {
    const view = resolveContentAssetLifecycleStage({
      article: { status: "已发布" },
      publishRecord: { publishUrl: "https://example.com/post" },
      inclusionRecord: {
        effectInclusionStatus: "included",
        inclusionVerifiedAt: "2026-06-01T00:00:00.000Z",
      },
      now: new Date("2026-06-10T00:00:00.000Z"),
    });
    expect(view.stage).toBe("can_retest");
    expect(view.label).toBe("可复测");
  });

  it("returns retested when after_publish ai test exists", () => {
    const view = resolveContentAssetLifecycleStage({
      article: { status: "已发布" },
      publishRecord: { publishUrl: "https://example.com/post" },
      inclusionRecord: {
        effectInclusionStatus: "included",
        inclusionVerifiedAt: "2026-06-01T00:00:00.000Z",
        aiTestResults: [{ testStage: "after_publish", question: "Q1" }],
      },
      now: new Date("2026-06-10T00:00:00.000Z"),
    });
    expect(view.stage).toBe("retested");
    expect(view.label).toBe("已复测");
  });

  it("returns retested when completed retest test round exists", () => {
    const view = resolveContentAssetLifecycleStage({
      article: { status: "已发布" },
      publishRecord: { publishUrl: "https://example.com/post" },
      inclusionRecord: {
        effectInclusionStatus: "included",
        inclusionVerifiedAt: "2026-06-01T00:00:00.000Z",
      },
      testRound: { roundType: "compare_retest", status: "completed" },
      now: new Date("2026-06-10T00:00:00.000Z"),
    });
    expect(view.stage).toBe("retested");
    expect(view.label).toBe("已复测");
  });
});

describe("pickLaggingContentAssetLifecycleStage", () => {
  it("picks the earliest stage among platform views", () => {
    const lagging = pickLaggingContentAssetLifecycleStage([
      resolveContentAssetLifecycleStage({ article: { status: "已发布" }, publishRecord: { publishUrl: "https://a" } }),
      resolveContentAssetLifecycleStage({ article: { status: "待质检" } }),
    ]);
    expect(lagging?.stage).toBe("pending_review");
    expect(lagging?.label).toBe("待质检");
  });
});

describe("buildContentAssetLifecycleProgressLabels", () => {
  it("marks reached stages up to current", () => {
    const progress = buildContentAssetLifecycleProgressLabels("queued");
    const queued = progress.find(item => item.stage === "queued");
    const published = progress.find(item => item.stage === "published");
    expect(queued?.current).toBe(true);
    expect(queued?.reached).toBe(true);
    expect(published?.reached).toBe(false);
  });
});
