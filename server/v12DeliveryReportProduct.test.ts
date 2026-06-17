import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");
const NO_PUBLIC_LINK = "待回填链接";

describe("Phase4 delivery report productization", () => {
  const page = read("client/src/pages/DeliveryReportsCenterPage.tsx");
  const productBody = read("client/src/components/delivery/DeliveryReportProductBody.tsx");
  const display = read("client/src/lib/deliveryReportProductDisplay.ts");
  const shared = read("shared/deliveryReportReadability.ts");
  const flow = read("client/src/pages/V12FlowPages.tsx");
  const monthlyShared = read("shared/monthlyReportView.ts");

  it("re-exports from V12FlowPages", () => {
    expect(flow).toContain(
      'export { DeliveryReportsCenterPage as DeliveryReportsFlowPage } from "./DeliveryReportsCenterPage"',
    );
    expect(flow).not.toContain("export function DeliveryReportsFlowPage");
  });

  it("delivery-reports route renders AI brand maturity monthly report", () => {
    for (const text of [
      "delivery-report-page",
      "delivery-report-page-intro",
      "monthly-report-title",
      "monthly-report-summary",
      "monthly-report-weaknesses",
      "monthly-report-actions",
      "monthly-report-next-month",
      "monthly-report-history",
      "monthly-report-executing-empty",
      "monthly-report-generate-next-plan",
      "AI 品牌成熟度月报",
      "续费评估和下月计划的依据",
      "geo.monthlyPlan.getReport",
    ]) {
      expect(page + monthlyShared).toContain(text);
    }
    expect(monthlyShared).toContain("复测完成后自动生成");
    expect(productBody).toContain("待回填链接");
    expect(shared).toContain("当前仅有优化前基线，尚不足以判断趋势变化");
  });

  it("does not fabricate or expose engineering fields on monthly report page", () => {
    expect(page).not.toContain("mock");
    expect(page).not.toContain("rawAnswer");
    expect(page).not.toContain("JSON.stringify");
    expect(page).not.toContain("publish_tasks");
  });

  it("legacy delivery report product components remain available", () => {
    expect(productBody).toContain(NO_PUBLIC_LINK);
    expect(display).toContain("DELIVERY_REPORT_PAGE_INTRO");
  });
});
