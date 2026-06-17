import { describe, expect, it } from "vitest";
import {
  buildContentOptimizationTaskView,
  buildRecommendedPlatformsForQuestion,
  MONTHLY_PLAN_SUGGEST_JOIN_HINT,
  MONTHLY_PLAN_UNBOUND_HINT,
  resolveMaturityDimensionForQuestion,
  UNPUBLISHED_RETEST_PLAN_SUMMARY,
} from "./contentOptimizationTaskView";

describe("contentOptimizationTaskView", () => {
  const baseQuestion = {
    id: 330001,
    questionText: "知识付费 SaaS 平台哪个好？",
    questionType: "scenario_need",
    searchPoolType: "scene_need",
    relatedGeoGap: "AI 未提及品牌",
    contentGapTags: ["场景覆盖不足"],
  };

  it("returns questionText for questionId entry", () => {
    const view = buildContentOptimizationTaskView({
      projectId: 150001,
      question: baseQuestion,
      articles: [],
      publishTasks: [],
    });
    expect(view.questionId).toBe(330001);
    expect(view.questionText).toBe("知识付费 SaaS 平台哪个好？");
    expect(view.projectId).toBe(150001);
  });

  it("maps questionType to maturity dimension", () => {
    expect(resolveMaturityDimensionForQuestion("brand_direct")).toBe("品牌实体清晰度");
    expect(resolveMaturityDimensionForQuestion("category_recommendation")).toBe("品类定位清晰度");
    expect(resolveMaturityDimensionForQuestion("scenario_need", "scene_need")).toBe("搜索问题覆盖度");
    expect(resolveMaturityDimensionForQuestion("competitor_compare", "comparison")).toBe("AI 实测表现");
    expect(resolveMaturityDimensionForQuestion("long_tail_pain", "long_tail")).toBe("搜索问题覆盖度");
    expect(resolveMaturityDimensionForQuestion("industry_location", "geo_region")).toBe("公开信源完整度");
  });

  it("includes recommendedPlatforms with customer reasons", () => {
    const platforms = buildRecommendedPlatformsForQuestion("scenario_need", "scene_need");
    expect(platforms.length).toBeGreaterThan(0);
    expect(platforms.every(item => item.platformLabel && item.reason.trim().length > 0)).toBe(true);
    expect(platforms.some(item => item.platformLabel === "知乎")).toBe(true);
    expect(platforms.find(item => item.platformLabel === "知乎")?.reason).toContain("怎么选");
  });

  it("returns monthly plan fallback when no plan is bound", () => {
    const view = buildContentOptimizationTaskView({
      projectId: 150001,
      question: baseQuestion,
      articles: [],
      publishTasks: [],
      monthlyPlan: null,
    });
    expect(view.monthlyPlanId).toBeNull();
    expect(view.monthlyPlanTitle).toBeNull();
    expect(view.monthlyPlanHint).toContain(MONTHLY_PLAN_UNBOUND_HINT);
    expect(view.monthlyPlanHint).toContain(MONTHLY_PLAN_SUGGEST_JOIN_HINT);
  });

  it("returns platformDrafts when platform articles exist", () => {
    const view = buildContentOptimizationTaskView({
      projectId: 150001,
      question: baseQuestion,
      articles: [
        {
          id: 1,
          title: "母稿标题",
          markdownContent: "# 母稿正文",
          status: "待质检",
        },
        {
          id: 2,
          title: "知乎平台稿",
          markdownContent: "平台正文",
          status: "待质检",
          generationBasis: {
            platformContentStrategy: { targetPublishPlatform: "zhihu" },
          },
        },
      ],
      publishTasks: [],
    });
    expect(view.platformDrafts).toHaveLength(1);
    expect(view.platformDrafts[0]?.platformLabel).toBe("知乎");
    expect(view.motherArticleId).toBe(1);
    expect(view.motherArticleTitle).toBe("母稿标题");
  });

  it("builds retest plan for unpublished and published content", () => {
    const unpublished = buildContentOptimizationTaskView({
      projectId: 150001,
      question: baseQuestion,
      articles: [],
      publishTasks: [],
    });
    expect(unpublished.retestPlan.summary).toBe(UNPUBLISHED_RETEST_PLAN_SUMMARY);
    expect(unpublished.retestPlan.milestones).toHaveLength(0);

    const published = buildContentOptimizationTaskView({
      projectId: 150001,
      question: baseQuestion,
      articles: [
        {
          id: 9,
          title: "已发布稿",
          status: "已发布",
          generationBasis: {
            platformContentStrategy: { targetPublishPlatform: "zhihu" },
          },
        },
      ],
      publishTasks: [{ articleId: 9, platform: "zhihu", status: "completed" }],
      completedPublishTasks: [
        {
          status: "completed",
          agentFinishedAt: new Date("2026-06-01T00:00:00.000Z"),
        },
      ],
      testRounds: [],
      now: new Date("2026-06-10T00:00:00.000Z"),
    });
    expect(published.retestPlan.publishAtLabel).toBeTruthy();
    expect(published.retestPlan.milestones.length).toBe(3);
    expect(published.retestPlan.milestones[0]?.title).toContain("7天");
  });
});
