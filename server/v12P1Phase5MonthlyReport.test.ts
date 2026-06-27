import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.0-P1-Phase5 Monthly Maturity Report", () => {
  it("implements monthly report view model in shared layer", () => {
    const shared = read("shared/monthlyReportView.ts");
    expect(shared).toContain("MONTHLY_REPORT_PAGE_TITLE");
    expect(shared).toContain("buildMonthlyReportView");
    expect(shared).toContain("computeAiTestRatesFromRuns");
    expect(shared).toContain("复测完成后自动生成");
  });

  it("exposes geo.monthlyPlan.getReport and retest auto completion", () => {
    const router = read("server/geoMonthlyPlanRouter.ts");
    expect(router).toContain("getReport:");
    expect(read("server/monthlyReportData.ts")).toContain("loadMonthlyReportData");
    expect(read("server/monthlyPlanRetestCompletion.ts")).toContain("completeMonthlyPlanRetest");
    const sync = read("server/monthlyPlanSync.ts");
    expect(sync).toContain("maybeAutoCompleteRetest");
    expect(sync).toContain("completeMonthlyPlanRetest");
  });

  it("upgrades delivery-reports page to AI brand maturity monthly report", () => {
    const page = read("client/src/pages/DeliveryReportsCenterPage.tsx");
    expect(page).toContain("delivery-report-page");
    expect(page).toContain("monthly-report-title");
    expect(page).toContain("AI 品牌成熟度月报");
    expect(page).toContain("geo.monthlyPlan.getReport");
    expect(page).toContain("monthly-report-summary");
    expect(page).toContain("monthly-report-weaknesses");
    expect(page).toContain("monthly-report-actions");
    expect(page).toContain("monthly-report-retest");
    expect(page).toContain("monthly-report-next-month");
    expect(page).toContain("monthly-report-content-asset");
    expect(page).toContain("monthly-report-renewal-justification");
    expect(page).toContain("本月内容资产成果");
    expect(page).toContain("为什么下月还值得继续做");
    expect(page).toContain("monthly-report-history");
    expect(page).toContain("monthly-report-executing-empty");
    expect(page + read("shared/monthlyReportView.ts")).toContain("续费评估和下月计划的依据");
  });

  it("updates navigation label for delivery reports entry", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain('label: "效果报告"');
    expect(layout).toContain('path: "/delivery-reports"');
  });
});
