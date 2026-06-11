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

  it("re-exports from V12FlowPages", () => {
    expect(flow).toContain(
      'export { DeliveryReportsCenterPage as DeliveryReportsFlowPage } from "./DeliveryReportsCenterPage"',
    );
    expect(flow).not.toContain("export function DeliveryReportsFlowPage");
  });

  it("first screen is customer delivery report with boss summary", () => {
    for (const text of [
      "delivery-report-page",
      "delivery-report-page-intro",
      "delivery-report-empty-state",
      "delivery-report-empty-cta",
      "本报告记录本轮GEO优化的执行动作、AI推荐变化和下月建议",
      "完成AI现状检测和内容发布后，系统将自动生成交付报告",
      "去开始AI现状检测",
      "delivery-report-boss-summary",
      "delivery-report-sticky-toolbar",
      "delivery-report-outcome-cards",
      "delivery-report-geo-attribution",
      "delivery-report-content-evidence",
      "delivery-report-retest-stages",
      "delivery-report-next-round-plan",
      "delivery-report-internal-checklist",
      "GEO 增长交付报告",
      "downloadDeliveryReportPdf",
      "delivery-report-export-pdf",
      "复制客户分享链接",
      "delivery-report-share-primary",
    ]) {
      expect(page + productBody + display + shared).toContain(text);
    }
    expect(display).toContain("当前数据不足，完成发布后复测后将生成本轮 GEO 增长结论。");
    expect(productBody).toContain("待回填链接");
    expect(shared).toContain("当前仅有优化前基线，尚不足以判断趋势变化");
  });

  it("does not fabricate or expose engineering fields", () => {
    expect(page).not.toContain("mock");
    expect(page).not.toContain("rawAnswer");
    expect(page).not.toContain("JSON.stringify");
    expect(page).not.toContain("publish_tasks");
    expect(page).toContain("sanitizeCustomerFacingEngineeringIds");
  });

  it("share and internal areas are folded", () => {
    expect(page).toContain("delivery-report-share-fold");
    expect(page).toContain("delivery-report-internal-fold");
    expect(page).toContain("createShareLink");
  });
});
