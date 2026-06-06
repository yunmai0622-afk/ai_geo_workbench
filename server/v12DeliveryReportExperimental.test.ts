import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 delivery report experimental upgrade", () => {
  const page = read("client/src/pages/DeliveryReportsCenterPage.tsx");
  const productBody = read("client/src/components/delivery/DeliveryReportProductBody.tsx");
  const shared = read("shared/deliveryReportExperimentalDisplay.ts");
  const reportUi = page + productBody;

  it("defines experimental report modules in shared display", () => {
    expect(shared).toContain("DELIVERY_REPORT_UNCERTAINTY_DISCLAIMER");
    expect(shared).toContain("buildDetectionScopeDisplay");
    expect(shared).toContain("buildT0BaselineSummary");
    expect(shared).toContain("不承诺单次优化必然带来推荐率提升");
  });

  it("embeds RetestComparisonPanel and experimental sections in report tab", () => {
    for (const text of [
      "delivery-report-detection-scope",
      "本期检测范围",
      "delivery-report-t0-baseline",
      "T0 基线结果摘要",
      "delivery-report-t0t1-comparison",
      "RetestComparisonPanel",
      "发布内容清单",
      "delivery-report-uncertainty",
      "DELIVERY_REPORT_UNCERTAINTY_DISCLAIMER",
    ]) {
      expect(reportUi).toContain(text);
    }
  });

  it("keeps real PDF export for delivery report", () => {
    expect(page).toContain("downloadDeliveryReportPdf");
    expect(reportUi).toContain("delivery-report-export-pdf");
    expect(reportUi).toContain("导出 PDF");
    expect(page).not.toContain("window.print()");
  });
});
