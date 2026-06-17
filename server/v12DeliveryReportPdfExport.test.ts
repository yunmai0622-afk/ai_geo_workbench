import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 delivery report PDF export", () => {
  const pdfModule = read("client/src/lib/deliveryReportPdfExport.ts");
  const productBody = read("client/src/components/delivery/DeliveryReportProductBody.tsx");

  it("exports report DOM to downloadable PDF via jspdf and html2canvas", () => {
    expect(pdfModule).toContain("downloadDeliveryReportPdf");
    expect(pdfModule).toContain("html2canvas");
    expect(pdfModule).toContain("jspdf");
    expect(productBody).toContain("delivery-report-export-pdf");
  });
});
