import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.1-P2 Renewal Proof Monthly Report", () => {
  it("exposes renewal proof view model helpers", () => {
    const shared = read("shared/monthlyReportView.ts");
    expect(shared).toContain("buildMonthlyReportContentAssetProof");
    expect(shared).toContain("buildMonthlyReportCompetitorRateExplanation");
    expect(shared).toContain("buildMonthlyReportRenewalJustification");
    expect(shared).toContain("MONTHLY_REPORT_CONTENT_ASSET_EMPTY_MESSAGE");
    expect(shared).toContain("MONTHLY_REPORT_RENEWAL_EMPTY_MESSAGE");
    expect(shared).not.toContain("renewalProofLines");
  });

  it("loads inclusion effect rows and uncovered questions in monthly report data", () => {
    const data = read("server/monthlyReportData.ts");
    expect(data).toContain("geoInclusionMonitoringRecords");
    expect(data).toContain("contentAssetEffectRows");
    expect(data).toContain("uncoveredQuestionCount");
    expect(data).toContain("questionTypeByQuestionId");
    expect(data).toContain("previousPlanGeneratedAt");
  });

  it("renders renewal proof sections on delivery-reports page", () => {
    const page = read("client/src/pages/DeliveryReportsCenterPage.tsx");
    expect(page).toContain("本月内容资产成果");
    expect(page).toContain("为什么下月还值得继续做");
    expect(page).toContain("monthly-report-content-asset");
    expect(page).toContain("monthly-report-renewal-justification");
    expect(page).toContain("competitorRateExplanation");
    expect(page).not.toContain("effectInclusionStatus");
    expect(page).not.toContain("ai_test_runs");
    expect(page).not.toContain("geo_inclusion_monitoring_records");
    expect(page).not.toContain("联系管理员");
  });
});
