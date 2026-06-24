import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.1-P3 Question Opportunity Map", () => {
  const page = read("client/src/pages/QuestionsLibraryPage.tsx");
  const flow = read("client/src/pages/V12FlowPages.tsx");
  const report = read("client/src/components/diagnosis/AiDiagnosisCustomerReport.tsx");
  const shared = read("shared/questionOpportunityMap.ts");

  it("question bank page uses opportunity map branding and metrics", () => {
    expect(page).toContain("AI 搜索机会地图");
    expect(page).toContain("了解客户会怎么问 AI，发现品牌可见度机会与竞品占位风险");
    expect(page).toContain("机会总览");
    expect(page).toContain("已覆盖内容问题数");
    expect(page).toContain("竞品占位问题数");
    expect(page).toContain("本月重点问题数");
    expect(page).toContain("question-opportunity-label-");
    expect(page).toContain("opportunityLabel");
  });

  it("diagnosis running progress avoids question index wording", () => {
    expect(read("shared/aiDiagnosisReportDisplay.ts")).toContain("formatAiDiagnosisRunningProgressLabel");
    expect(report).toContain("formatAiDiagnosisRunningProgressLabel");
    expect(report).toContain("ai-diagnosis-running-progress-label");
    expect(report).not.toContain("已检测问题");
    expect(flow).toContain("formatAiDiagnosisRunningProgressLabel");
    expect(flow).not.toMatch(/已检测问题/);
  });

  it("diagnosis fold separates retest console from results", () => {
    expect(flow).toContain("data-testid=\"ai-diagnosis-retest-console\"");
    expect(flow).toContain("重新发起检测");
    expect(flow).toContain("data-testid=\"ai-diagnosis-t0-results\"");
    expect(flow).toContain("data-testid=\"ai-diagnosis-t0-by-platform\"");
  });

  it("shared opportunity map derives competitor occupancy threshold", () => {
    expect(shared).toContain("COMPETITOR_OCCUPANCY_THRESHOLD");
    expect(shared).toContain("computeQuestionCompetitorRates");
    expect(read("server/questionSearchPoolService.ts")).toContain("computeQuestionCompetitorRates");
    expect(read("server/questionSearchPoolService.ts")).toContain("monthlyOptimizationTasks");
  });
});
