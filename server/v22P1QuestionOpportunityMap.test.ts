import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.2 P1 AI search opportunity map", () => {
  it("adds a first-screen opportunity map without replacing the question pool", () => {
    const page = read("client/src/pages/QuestionsLibraryPage.tsx");
    const panel = read("client/src/components/questions/QuestionOpportunityMapPanel.tsx");
    const shared = read("shared/questionOpportunityMap.ts");

    expect(shared).toContain("buildQuestionOpportunityMapView");
    expect(shared).toContain("本月优先抢回");
    expect(shared).toContain("monthlyPriorityNames");
    expect(shared).toContain("生成内容任务");
    expect(page).toContain("QuestionOpportunityMapPanel");
    expect(page).toContain("geo.monthlyPlan.getOptimizationBrief");
    expect(page).toContain("handleOpportunityItemAction");
    expect(panel).toContain("question-opportunity-map-panel");
    expect(panel).toContain("question-opportunity-map-top3-line");
    expect(panel).toContain("优先抢占清单");
    expect(panel).toContain("clusterLine");
    expect(page).toContain("QuestionPoolTable");
    expect(page).toContain("question-pool-overview");
  });

  it("keeps customer copy focused on opportunity, evidence and next action", () => {
    const panel = read("client/src/components/questions/QuestionOpportunityMapPanel.tsx");
    const shared = read("shared/questionOpportunityMap.ts");
    expect(panel).toContain("AI 搜索机会地图");
    expect(panel).toContain("下一步原因");
    expect(shared).toContain("抢竞品占位");
    expect(shared).toContain("补内容覆盖");
    expect(shared).toContain("推发布收录");
    expect(shared).toContain("看复测变化");
  });
});
