import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.1-P3 AI Retest Attribution", () => {
  const shared = read("shared/contentRetestAttribution.ts");
  const inclusionPage = read("client/src/pages/InclusionMonitoringCenterPage.tsx");
  const attributionPanel = read("client/src/components/inclusion-monitoring/ContentRetestAttributionPanel.tsx");
  const deliveryPage = read("client/src/pages/DeliveryReportsCenterPage.tsx");
  const monthlyShared = read("shared/monthlyReportView.ts");
  const router = read("server/routers.ts");

  it("shared module uses customer-facing labels", () => {
    expect(shared).toContain("buildContentRetestAttributionView");
    expect(shared).toContain("优化前基线");
    expect(shared).toContain("发布后复测");
    expect(shared).not.toContain("rawAnswer");
    expect(shared).not.toContain("mentionRate");
    expect(shared).not.toContain("T0_BASELINE");
  });

  it("inclusion monitoring exposes retest attribution panel", () => {
    expect(inclusionPage).toContain("ContentRetestAttributionPanel");
    expect(inclusionPage).toContain("retestAttribution");
    expect(attributionPanel).toContain("查看AI复测结果");
    expect(attributionPanel).toContain("关联AI搜索问题");
    expect(attributionPanel).not.toContain("rawAnswer");
    expect(attributionPanel).not.toContain("T0");
  });

  it("monthly report includes content impact proof section", () => {
    expect(deliveryPage).toContain("monthly-report-content-impact-proof");
    expect(deliveryPage).toContain("内容影响证明");
    expect(deliveryPage).toContain("delivery-report-real-evidence-update");
    expect(deliveryPage).toContain("AI T1 发布后复测");
    expect(deliveryPage).toContain("T1 未提及");
    expect(deliveryPage).toContain("T1 未推荐");
    expect(deliveryPage).toContain("delivery-report-continuous-retest-plan");
    expect(deliveryPage).toContain("第 3 天");
    expect(deliveryPage).toContain("第 7 天");
    expect(deliveryPage).toContain("第 14 天");
    expect(deliveryPage).toContain("不提前写成已收录或已提升");
    expect(deliveryPage).toContain("内容级发布后复测");
    expect(monthlyShared).toContain("contentImpactProof");
  });

  it("API enriches inclusion records with retest attribution", () => {
    expect(router).toContain("buildRetestAttributionForInclusionRecords");
    expect(router).toContain("retestAttribution");
  });
});
