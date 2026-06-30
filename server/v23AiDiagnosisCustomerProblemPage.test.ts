import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.3-P0-F AI diagnosis customer problem page", () => {
  const report = read("client/src/components/diagnosis/AiDiagnosisCustomerReport.tsx");
  const flow = read("client/src/pages/V12FlowPages.tsx");

  it("turns AI diagnosis into a customer-readable problem page", () => {
    expect(report).toContain("诊断问题页");
    expect(report).toContain("为什么 AI 还不稳定推荐你");
    expect(report).toContain("把实测结果翻译成客户能理解的原因、影响和本月修复动作");
    expect(report).toContain("AI 是否知道你");
    expect(report).toContain("AI 是否愿意推荐你");
    expect(report).toContain("AI 是否说得准");
    expect(report).toContain("哪些问题还没覆盖");
    expect(report).toContain('data-testid="ai-diagnosis-customer-metrics"');
    expect(report).toContain('data-testid="ai-diagnosis-top-problems"');
    expect(report).toContain('data-testid="ai-diagnosis-primary-cta"');
  });

  it("shows evidence summary, scenario breakdown, miss reasons, and repair path", () => {
    expect(report).toContain("诊断证据摘要");
    expect(report).toContain("问题场景拆解");
    expect(report).toContain("AI 为什么不稳定推荐");
    expect(report).toContain("从诊断到修复路径");
    expect(report).toContain("诊断问题");
    expect(report).toContain("本月方案");
    expect(report).toContain("内容执行");
    expect(report).toContain("效果验证");
    expect(report).toContain("效果报告");
    expect(report).toContain('data-testid="ai-diagnosis-evidence-summary"');
    expect(report).toContain('data-testid="ai-diagnosis-scenario-breakdown"');
    expect(report).toContain('data-testid="ai-diagnosis-not-recommended-reasons"');
    expect(report).toContain('data-testid="ai-diagnosis-repair-path"');
  });

  it("downgrades raw data and operational details below the customer page", () => {
    const reportIndex = flow.indexOf("AiDiagnosisCustomerReport");
    const detailFoldIndex = flow.indexOf('data-testid="ai-diagnosis-detail-fold"');
    expect(flow).toContain("运营诊断明细 / 证据详情");
    expect(flow).toContain("原始回答、检测记录、问题明细、诊断控制台");
    expect(detailFoldIndex).toBeGreaterThan(reportIndex);
    expect(flow).toContain("原始 AI 回答详情");
    expect(flow).toContain("诊断流程控制台");
  });

  it("does not place engineering identifiers in the customer report component", () => {
    for (const forbidden of ["questionId", "sourceType", "runId", "workflow", "bundle", "commit", "错误堆栈"]) {
      expect(report).not.toContain(forbidden);
    }
  });
});
