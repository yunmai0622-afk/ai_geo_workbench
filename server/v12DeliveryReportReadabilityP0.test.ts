import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 DeliveryReport Productized Readability P0", () => {
  const page = read("client/src/pages/DeliveryReportsCenterPage.tsx");
  const productBody = read("client/src/components/delivery/DeliveryReportProductBody.tsx");
  const customerSections = read("client/src/components/delivery/DeliveryReportCustomerProductSections.tsx");
  const lightView = read("client/src/components/DeliveryReportCustomerLightView.tsx");
  const publicPage = read("client/src/pages/DeliveryReportPublicPage.tsx");
  const sharePage = read("client/src/pages/DeliveryReportSharePage.tsx");
  const shared = read("shared/deliveryReportReadability.ts");

  it("internal page has boss summary on first screen", () => {
    expect(page + productBody).toContain("delivery-report-boss-summary");
    expect(page + productBody + shared).toContain("GEO 增长交付报告");
  });

  it("wires data completeness label in toolbar and checklist", () => {
    expect(shared).toContain("computeDeliveryDataCompleteness");
    expect(page).toContain("computeDeliveryDataCompleteness");
    expect(page).toContain("dataCompletenessLabel");
    expect(productBody).toContain("delivery-report-data-completeness");
  });

  it("shows T0-only trend insufficient message", () => {
    expect(shared).toContain("当前仅有 T0 基线，尚不足以判断趋势变化");
    expect(productBody).toContain("delivery-report-geo-attribution");
  });

  it("shows missing link reason and internal fill-link button", () => {
    expect(productBody).toContain("待回填链接");
    expect(productBody).toContain("去回填链接");
    expect(productBody).toContain("原因：发布完成后尚未回填链接");
  });

  it("customer share pages hide internal controls", () => {
    expect(customerSections).toContain('mode="customer"');
    expect(customerSections).not.toContain("去回填链接");
    expect(lightView).not.toContain("delivery-report-internal-checklist");
    expect(publicPage).not.toContain("delivery-report-internal-checklist");
    expect(sharePage).not.toContain("delivery-report-internal-checklist");
  });

  it("avoids meaningless dash placeholders in product body", () => {
    expect(productBody).not.toContain('"--"');
    expect(productBody).not.toContain(">--<");
  });

  it("does not fabricate retest results in shared builder", () => {
    expect(shared).toContain("resolveStageStatusLabel");
    expect(shared).not.toContain("mock");
  });

  it("has geo attribution and next round plan modules", () => {
    expect(productBody).toContain("delivery-report-geo-attribution");
    expect(productBody).toContain("delivery-report-next-round-plan");
  });

  it("keeps PDF export and share link buttons", () => {
    expect(page + productBody).toContain("delivery-report-export-pdf");
    expect(page + productBody).toContain("复制客户分享链接");
    expect(page).toContain("downloadDeliveryReportPdf");
  });

  it("internal checklist only on internal page", () => {
    expect(page).toContain("DeliveryReportInternalChecklist");
    expect(productBody).toContain("delivery-report-internal-checklist");
    expect(publicPage).not.toContain("DeliveryReportInternalChecklist");
  });
});
