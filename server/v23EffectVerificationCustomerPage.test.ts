import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.3-P0-E effect verification customer page", () => {
  const page = read("client/src/pages/InclusionMonitoringCenterPage.tsx");
  const fillPanel = read("client/src/components/inclusion-monitoring/ContentAssetEffectFillPanel.tsx");

  it("turns inclusion-monitoring into a customer-facing effect verification page", () => {
    expect(page).toContain("效果验证");
    expect(page).toContain("客户可读结论");
    expect(page).toContain("内容有没有被搜索看见");
    expect(page).toContain("AI 有没有识别");
    expect(page).toContain('data-testid="effect-verification-customer-overview"');
    expect(page).toContain('data-testid="effect-verification-conclusion"');
    expect(page).toContain('data-testid="effect-verification-core-metrics"');
    expect(page).toContain('data-testid="effect-verification-blockers"');
    expect(page).toContain('data-testid="effect-verification-primary-cta"');
  });

  it("shows a service flow and evidence summary before operational details", () => {
    const overviewIndex = page.indexOf("<EffectVerificationCustomerOverview");
    const processIndex = page.indexOf("<EffectVerificationProcess");
    const evidenceIndex = page.indexOf("<EffectVerificationEvidenceSummary");
    const advancedIndex = page.indexOf('data-testid="effect-verification-advanced-details"');

    expect(page).toContain("发布 → 收录 → 数据回填 → AI 复测 → 效果报告");
    expect(page).toContain("客户可见证据摘要");
    expect(page).toContain("下一份报告能证明什么");
    expect(page).toContain("不承诺保证收录、排名或 AI 推荐");
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
