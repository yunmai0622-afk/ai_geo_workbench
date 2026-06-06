import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 delivery report PDF export", () => {
  const page = read("client/src/pages/DeliveryReportsCenterPage.tsx");
  const productBody = read("client/src/components/delivery/DeliveryReportProductBody.tsx");
  const exportLib = read("client/src/lib/deliveryReportPdfExport.ts");
  const shared = read("shared/geoDataExport.ts");
  const reportUi = page + productBody;

  it("exports report DOM to downloadable PDF via jspdf and html2canvas", () => {
    expect(reportUi).toContain('data-testid="delivery-report-export-pdf"');
    expect(page).toContain("handleExportDeliveryPdf");
    expect(page).toContain("downloadDeliveryReportPdf");
    expect(page).not.toContain("window.print()");
  });

  it("uses shared PDF filename builder and blob download", () => {
    expect(exportLib).toContain("html2canvas");
    expect(exportLib).toContain("jsPDF");
    expect(exportLib).toContain("buildGeoReportPdfFilename");
    expect(exportLib).toContain('output("blob")');
    expect(shared).toContain("buildGeoReportPdfFilename");
  });
});
