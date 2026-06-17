import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.0-P1-ContentTask-Flow-Foundation", () => {
  it("defines ContentOptimizationTaskView in shared layer", () => {
    const shared = read("shared/contentOptimizationTaskView.ts");
    expect(shared).toContain("export type ContentOptimizationTaskView");
    expect(shared).toContain("recommendedPlatforms");
    expect(shared).toContain("platformDrafts");
    expect(shared).toContain("retestPlan");
    expect(shared).toContain("monthlyPlanHint");
  });

  it("exposes geo.contentTasks.getCurrentTaskView router", () => {
    const routers = read("server/routers.ts");
    const router = read("server/geoContentTasksRouter.ts");
    expect(routers).toContain("geoContentTasksRouter");
    expect(routers).toContain("contentTasks: geoContentTasksRouter");
    expect(router).toContain("getCurrentTaskView:");
    expect(router).toContain("buildCurrentContentOptimizationTaskView");
  });

  it("maps question maturity dimension and platform recommendations", () => {
    const shared = read("shared/contentOptimizationTaskView.ts");
    expect(shared).toContain("resolveMaturityDimensionForQuestion");
    expect(shared).toContain("buildRecommendedPlatformsForQuestion");
    expect(shared).toContain("品牌实体清晰度");
    expect(shared).toContain("适合回答");
    expect(shared).toContain("适合沉淀公开信源");
  });

  it("includes monthly plan fallback copy", () => {
    const shared = read("shared/contentOptimizationTaskView.ts");
    expect(shared).toContain("暂未绑定本月计划");
    expect(shared).toContain("建议加入本月优化计划");
  });

  it("covers unified task view tests", () => {
    const tests = read("shared/contentOptimizationTaskView.test.ts");
    expect(tests).toContain("returns questionText for questionId entry");
    expect(tests).toContain("maps questionType to maturity dimension");
    expect(tests).toContain("recommendedPlatforms with customer reasons");
    expect(tests).toContain("monthly plan fallback");
    expect(tests).toContain("platformDrafts when platform articles exist");
    expect(tests).toContain("retest plan for unpublished and published content");
  });

  it("integrates getCurrentTaskView into WeeklyContentPage first screen", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    const taskCard = read("client/src/components/weekly/WeeklyContentTaskControlCard.tsx");
    expect(weekly).toContain("geo.contentTasks.getCurrentTaskView");
    expect(weekly).toContain("contentTaskViewQuery");
    expect(taskCard).toContain("对应 AI 搜索问题");
    expect(taskCard).toContain("目标短板");
    expect(taskCard).toContain("发布后复测计划");
    expect(taskCard).toContain("weekly-task-view-fallback-message");
    expect(taskCard).toContain("weekly-go-monthly-plan");
  });
});
