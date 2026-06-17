import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 delivery report experimental upgrade", () => {
  const page = read("client/src/pages/DeliveryReportsCenterPage.tsx");
  const productBody = read("client/src/components/delivery/DeliveryReportProductBody.tsx");
  const shared = read("shared/deliveryReportExperimentalDisplay.ts");
  const legacyReportUi = productBody;

  it("defines experimental report modules in shared display", () => {
    expect(shared).toContain("DELIVERY_REPORT_UNCERTAINTY_DISCLAIMER");
    expect(shared).toContain("buildDetectionScopeDisplay");
    expect(shared).toContain("buildT0BaselineSummary");
    expect(shared).toContain("不承诺单次优化必然带来推荐率提升");
  });

  it("keeps experimental sections in legacy delivery product body", () => {
    for (const text of [
      "delivery-report-geo-attribution",
      "delivery-report-retest-stages",
      "delivery-report-content-evidence",
      "DELIVERY_REPORT_UNCERTAINTY_DISCLAIMER",
    ]) {
      expect(legacyReportUi + shared).toContain(text);
    }
  });

  it("monthly report page focuses on plan-based sections", () => {
    expect(page).toContain("monthly-report-summary");
    expect(page).toContain("monthly-report-retest");
    expect(page).not.toContain("window.print()");
    expect(read("client/src/lib/deliveryReportPdfExport.ts")).toContain("downloadDeliveryReportPdf");
  });
});
