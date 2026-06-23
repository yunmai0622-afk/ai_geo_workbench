import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.0-P1-Phase4-AITest-Report", () => {
  it("AI diagnosis first screen implements before/running/completed states", () => {
    const flow = read("client/src/pages/V12FlowPages.tsx");
    const report = read("client/src/components/diagnosis/AiDiagnosisCustomerReport.tsx");
    expect(flow).toContain("resolveAiDiagnosisFirstScreenState");
    expect(flow).toContain("AiDiagnosisCustomerReport");
    expect(report).toContain("开始 AI 现状诊断");
    expect(report).toContain("AI 正在后台检测中");
    expect(report).toContain("刷新进度");
    expect(report).toContain("去执行本月任务");
    expect(report).toContain("AI 当前怎么看你");
    expect(report).toContain("查看本月优化计划");
  });

  it("core conclusion card and report copy helpers exist", () => {
    const shared = read("shared/aiDiagnosisReportDisplay.ts");
    const report = read("client/src/components/diagnosis/AiDiagnosisCustomerReport.tsx");
    expect(shared).toContain("resolveAiRecognitionStatus");
    expect(shared).toContain("resolveAiRecommendStatus");
    expect(shared).toContain("buildAiDiagnosisReportConclusion");
    expect(shared).toContain("buildAiDiagnosisReportActionSuggestions");

    expect(report).toContain('testId="ai-diagnosis-recognition-status"');
    expect(report).toContain('testId="ai-diagnosis-recommend-status"');
    expect(report).toContain("data-testid=\"ai-diagnosis-report-conclusion\"");
    expect(report).toContain("data-testid=\"ai-diagnosis-top-improvements\"");
    expect(report).toContain("ai-diagnosis-top-improvements-empty");
    expect(report).toContain("ai-diagnosis-go-maturity-score");
    expect(report).toContain("AI品牌成熟度评分尚未完成，暂无改善建议");
  });

  it("technical sections are folded under detail fold", () => {
    const flow = read("client/src/pages/V12FlowPages.tsx");
    expect(flow).toContain("data-testid=\"ai-diagnosis-detail-fold\"");
    expect(flow).toContain("查看完整检测数据");
    expect(flow).toContain("原始 AI 回答详情");
    expect(flow).toContain("查看历史检测记录");
    expect(flow).toContain("实测对比面板");
    expect(flow).toContain("诊断流程控制台");
    expect(flow).toContain("QuestionPoolTestPanel");
    expect(flow).toContain('firstScreenState !== "running"');
  });

  it("maturity page top weakness CTA links to monthly plan", () => {
    const page = read("client/src/pages/MaturityDetailPage.tsx");
    expect(page).toContain("生成本月优化计划");
    expect(page).toContain("查看本月优化计划");
    expect(page).toContain("geo.monthlyPlan.generate");
    expect(page).toContain('buildProjectUrl("/monthly-plan"');
  });
});
