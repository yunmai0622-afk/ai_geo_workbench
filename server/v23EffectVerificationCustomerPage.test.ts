import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.3-P0-E effect verification customer page", () => {
  const page = read("client/src/pages/InclusionMonitoringCenterPage.tsx");
  const fillPanel = read("client/src/components/inclusion-monitoring/ContentAssetEffectFillPanel.tsx");

  it("turns inclusion-monitoring into a customer-facing effect verification page", () => {
    expect(page).toContain("收录与 AI 复测");
    expect(page).toContain("客户可读结论");
    expect(page).toContain("验证已建设的公开品牌资产是否被搜索和 AI 看见");
    expect(page).toContain("AI 复测");
    expect(page).toContain('data-testid="effect-verification-customer-overview"');
    expect(page).toContain('data-testid="effect-verification-conclusion"');
    expect(page).toContain('data-testid="effect-verification-core-metrics"');
    expect(page).toContain('data-testid="effect-verification-blockers"');
    expect(page).toContain('data-testid="effect-verification-primary-cta"');
  });

  it("keeps service flow and evidence summary folded behind the customer overview", () => {
    const overviewIndex = page.indexOf("<EffectVerificationCustomerOverview");
    const processIndex = page.indexOf("<EffectVerificationProcess");
    const evidenceIndex = page.indexOf("<EffectVerificationEvidenceSummary");
    const advancedIndex = page.indexOf('data-testid="effect-verification-advanced-details"');

    expect(page).toContain('data-testid="effect-verification-evidence-fold"');
    expect(page).toContain("发布 → 收录 → 数据回填 → AI 复测 → 交付报告");
    expect(page).toContain("客户可见证据摘要");
    expect(page).toContain("最近验证记录");
    expect(page).toContain("证据仍在积累中");
    expect(page).toContain("流程、技术证据和明细默认收起");
    expect(processIndex).toBeGreaterThan(overviewIndex);
    expect(evidenceIndex).toBeGreaterThan(processIndex);
    expect(advancedIndex).toBeGreaterThan(evidenceIndex);
  });

  it("keeps operational tools available but downgraded to an advanced area", () => {
    expect(page).toContain("运营明细与数据回填");
    expect(page).toContain("内容资产列表、平台汇总和 AI 复测操作已降级到运营区");
    expect(page).toContain('data-testid="inclusion-monitoring-content-table"');
    expect(page).toContain('data-testid="content-asset-platform-summary"');
    expect(page).toContain('data-testid="content-asset-retest-ready"');
    expect(page).toContain("ContentAssetEffectFillPanel");
    expect(fillPanel).toContain("填写效果数据");
    expect(page).toContain("加入AI复测");
  });

  it("does not put engineering deployment language into the customer page source", () => {
    for (const forbidden of ["workflow", "bundle", "commit", "错误堆栈"]) {
      expect(page).not.toContain(forbidden);
    }
  });
});
