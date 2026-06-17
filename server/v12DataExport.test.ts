import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("GEO-V1.1-Data-Export static", () => {
  it("legacy delivery report stack still exposes CSV export helpers", () => {
    const legacy = read("client/src/lib/geoDataExportDownload.ts") + read("shared/geoDataExport.ts");
    expect(legacy).toContain("downloadDeliveryReportCsv");
    expect(legacy).toContain("buildGeoReportCsvFilename");
  });

  it("publish center exposes publish records CSV export", () => {
    const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
    expect(page).toContain('data-testid="publish-records-export-csv"');
    expect(page).toContain("导出发布记录");
    expect(page).toContain("downloadPublishRecordsCsv");
  });

  it("ai diagnosis page exposes T0 results CSV export", () => {
    const page = read("client/src/pages/V12FlowPages.tsx");
    expect(page).toContain('data-testid="ai-diagnosis-t0-export-csv"');
    expect(page).toContain("导出检测结果");
    expect(page).toContain("downloadT0ResultsCsv");
  });

  it("shared geoDataExport defines BOM and geo-report filename", () => {
    const shared = read("shared/geoDataExport.ts");
    expect(shared).toContain("GEO_CSV_UTF8_BOM");
    expect(shared).toContain("buildGeoReportCsvFilename");
    expect(shared).toContain("geo-report-");
    expect(shared).toContain("buildGeoT0ResultCsvFilename");
    expect(shared).toContain("t0-result-");
    expect(shared).toContain("buildT0ResultsCsvContent");
  });

  it("monthly report page and settings expose data guidance", () => {
    const delivery = read("client/src/pages/DeliveryReportsCenterPage.tsx");
    expect(delivery).toContain("monthly-report-history");
    expect(delivery).toContain("geo.monthlyPlan.getReport");

    const settings = read("client/src/pages/SettingsPage.tsx");
    expect(settings).toContain('data-testid="settings-data-export-section"');
    expect(settings).toContain("数据导出");
    expect(settings).toContain("导出发布记录");
  });
});
