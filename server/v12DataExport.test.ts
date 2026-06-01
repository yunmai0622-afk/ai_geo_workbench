import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("GEO-V1.1-Data-Export static", () => {
  it("delivery report page exposes CSV export control", () => {
    const page = read("client/src/pages/DeliveryReportsCenterPage.tsx");
    expect(page).toContain('data-testid="delivery-report-export-csv"');
    expect(page).toContain("导出 CSV");
    expect(page).toContain("downloadDeliveryReportCsv");
  });

  it("publish center exposes publish records CSV export", () => {
    const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
    expect(page).toContain('data-testid="publish-records-export-csv"');
    expect(page).toContain("导出发布记录");
    expect(page).toContain("downloadPublishRecordsCsv");
  });

  it("shared geoDataExport defines BOM and geo-report filename", () => {
    const shared = read("shared/geoDataExport.ts");
    expect(shared).toContain("GEO_CSV_UTF8_BOM");
    expect(shared).toContain("buildGeoReportCsvFilename");
    expect(shared).toContain("geo-report-");
  });

  it("delivery report and settings expose backup export hints", () => {
    const delivery = read("client/src/pages/DeliveryReportsCenterPage.tsx");
    expect(delivery).toContain('data-testid="delivery-report-export-backup-hint"');
    expect(delivery).toContain("建议定期导出报告数据备份");
    expect(delivery).toContain("导出CSV");

    const settings = read("client/src/pages/SettingsPage.tsx");
    expect(settings).toContain('data-testid="settings-data-export-section"');
    expect(settings).toContain("数据导出");
    expect(settings).toContain("导出发布记录");
  });
});
