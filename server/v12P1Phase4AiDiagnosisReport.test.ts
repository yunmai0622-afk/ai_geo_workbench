import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.0-P1-Phase4-AITest-Report", () => {
  it("AI diagnosis first screen implements before/running/completed states", () => {
    const flow = read("client/src/pages/V12FlowPages.tsx");
    expect(flow).toContain("resolveAiDiagnosisFirstScreenState");
    expect(flow).toContain('firstScreenState === "before"');
    expect(flow).toContain('firstScreenState === "running"');
    expect(flow).toContain('firstScreenState === "completed"');
    expect(flow).toContain("尚未建立优化前基线");
    expect(flow).toContain("创建 AI 现状检测任务");
    expect(flow).toContain("AI 现状检测正在后台执行");
    expect(flow).toContain("刷新进度");
    expect(flow).toContain("去执行本月任务");
    expect(flow).toContain("AI 当前怎么看你");
    expect(flow).toContain("查看本月优化计划");
  });

  it("core conclusion card and report copy helpers exist", () => {
    const shared = read("shared/aiDiagnosisReportDisplay.ts");
    expect(shared).toContain("resolveAiRecognitionStatus");
    expect(shared).toContain("resolveAiRecommendStatus");
    expect(shared).toContain("buildAiDiagnosisReportConclusion");
    expect(shared).toContain("buildAiDiagnosisReportActionSuggestions");

    const flow = read("client/src/pages/V12FlowPages.tsx");
    expect(flow).toContain("data-testid=\"ai-diagnosis-recognition-status\"");
    expect(flow).toContain("data-testid=\"ai-diagnosis-recommend-status\"");
    expect(flow).toContain("data-testid=\"ai-diagnosis-report-conclusion\"");
    expect(flow).toContain("data-testid=\"ai-diagnosis-report-actions\"");
  });

  it("technical sections are folded under detail fold", () => {
    const flow = read("client/src/pages/V12FlowPages.tsx");
    expect(flow).toContain("data-testid=\"ai-diagnosis-detail-fold\"");
    expect(flow).toContain("查看检测详情");
    expect(flow).toContain("原始 AI 回答详情");
    expect(flow).toContain("检测轮次历史");
    expect(flow).toContain("实测对比面板");
    expect(flow).toContain("诊断流程控制台");
    expect(flow).toContain("QuestionPoolTestPanel");
  });

  it("maturity page top weakness CTA links to monthly plan", () => {
    const page = read("client/src/pages/MaturityDetailPage.tsx");
    expect(page).toContain("生成本月优化计划");
    expect(page).toContain("查看本月优化计划");
    expect(page).toContain("geo.monthlyPlan.generate");
    expect(page).toContain('buildProjectUrl("/monthly-plan"');
  });
});
