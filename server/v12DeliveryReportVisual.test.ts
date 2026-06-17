import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf-8");

describe("delivery report visual hierarchy (C3-A / C3-B)", () => {
  const customerView = readProjectFile("client/src/components/DeliveryReportCustomerView.tsx");
  const customerLightView = readProjectFile("client/src/components/DeliveryReportCustomerLightView.tsx");
  const competitorSection = readProjectFile("client/src/components/DeliveryReportCompetitorSection.tsx");
  const displayLib = readProjectFile("client/src/lib/deliveryReportDisplay.ts");
  const flow = readProjectFile("client/src/pages/V12FlowPages.tsx");
  const share = readProjectFile("client/src/pages/DeliveryReportSharePage.tsx");
  const publicPage = readProjectFile("client/src/pages/DeliveryReportPublicPage.tsx");

  it("renders business conclusion and summary (C3-B)", () => {
    for (const text of ["经营结论", "本轮报告摘要", "下一轮优化动作", "buildBusinessConclusion", "buildReportSummaryLines"]) {
      expect(customerView + displayLib).toContain(text);
    }
  });

  it("renders assets language (C3-B)", () => {
    expect(customerView).toContain("本轮新增 AI 搜索资产");
    expect(customerView).toContain("发布前后变化");
    expect(customerView).toContain("buildAiTestExplanation");
  });

  it("monthly report center page registered alongside legacy customer views", () => {
    expect(readProjectFile("client/src/pages/DeliveryReportsCenterPage.tsx")).toContain("delivery-report-page");
    expect(readProjectFile("client/src/pages/DeliveryReportsCenterPage.tsx")).toContain("monthly-report-summary");
    expect(share).toContain("visibilityScore");
    expect(share).toContain("publishedItems");
  });

  it("hides before-after section when no stage data", () => {
    expect(displayLib).toContain("showPublishCompareSection");
    expect(customerView).toContain("showPublishCompareSection");
    expect(customerView).toMatch(/showCompare \?/);
  });

  it("does not expose internal field names in customer view", () => {
    for (const forbidden of [
      "rawAnswer",
      "taskId",
      "provider",
      "adapter",
      "mock",
      "schema",
      "testStage",
      "before_publish",
      "after_publish",
      "manual_check",
      "aiTestResults",
      "articleId",
      "recordId",
      "publicUrl",
      "missReason",
      "projectId",
      "token",
    ]) {
      expect(customerView).not.toContain(forbidden);
    }
    expect(publicPage).not.toContain("复制客户报告链接");
    expect(publicPage).not.toContain("重新生成客户报告链接");
    expect(publicPage).not.toContain("禁用客户报告链接");
  });

  it("limits next actions to at most three", () => {
    expect(displayLib).toContain("buildNextActionLines");
    expect(customerView).toContain("buildNextActionLines");
    expect(displayLib).toMatch(/slice\(0, 3\)/);
  });

  it("uses mobile-safe layout classes for overflow and stacking", () => {
    expect(customerView).toContain("overflow-x-hidden");
    expect(customerView).toContain("table-fixed");
    expect(customerView).toContain("grid-cols-1");
    expect(customerView).toContain("break-all");
    expect(customerView).toContain("break-words");
  });

  it("renders retest hero at top of light delivery report (GEO-V1.1-Retest-Visual-Report)", () => {
    const retestHero = readProjectFile("client/src/components/DeliveryReportRetestHero.tsx");
    expect(customerLightView).toContain("DeliveryReportRetestHero");
    expect(customerLightView).toContain("publishCompare={aiTestAggregate.publishCompare}");
    expect(retestHero).toContain('data-testid="delivery-report-retest-hero"');
    expect(retestHero).toContain("发布前提及率");
    expect(retestHero).toContain("发布后提及率");
    expect(retestHero).toContain("优化前基线");
    expect(retestHero).toContain("等待发布后7天执行T1复测");
    expect(readProjectFile("client/src/lib/deliveryReportLightDisplay.ts")).toContain("buildPublishRetestHeroContent");
  });

  it("renders competitor comparison section on delivery report (GEO-V1.1)", () => {
    expect(customerLightView).toContain("竞品对比");
    expect(customerLightView).toContain("DeliveryReportCompetitorSection");
    expect(competitorSection).toContain("AI 提及次数对比");
    expect(competitorSection).toContain("各平台竞品内容分布");
    expect(competitorSection).toContain("建议补充的内容方向");
    expect(share).toContain("competitorAnalysisSummary");
    expect(publicPage).toContain("competitorComparison");
    expect(readProjectFile("server/deliveryReportPublicShare.ts")).toContain("resolveCompetitorAnalysisSummary");
    expect(readProjectFile("shared/deliveryReportPublicShare.ts")).toContain("competitorComparison");
  });

  it("content quality summary remains in shared delivery modules", () => {
    expect(readProjectFile("shared/deliveryReportContentQuality.ts")).toContain(
      "buildDeliveryReportContentQualitySummary",
    );
    expect(readProjectFile("server/deliveryReportContentQuality.ts")).toContain("geoArticleQualityScores");
  });

  it("anonymous report renders published content from publicShare", () => {
    expect(publicPage).toContain("publishedContent");
    expect(customerView).toContain("本轮新增 AI 搜索资产");
    expect(customerView).toContain("查看文章");
    expect(customerView).toContain("本轮暂无发布记录");
    expect(readProjectFile("shared/deliveryReportPublicShare.ts")).toContain("publishedContent");
    expect(readProjectFile("shared/deliveryReportPublicShare.ts")).toContain("visibilityScore");
    expect(readProjectFile("server/deliveryReportPublicShare.ts")).toContain("mapRecordsToPublicPublishedContent");
    expect(readProjectFile("server/deliveryReportPublicShare.ts")).toContain("resolveDeliveryReportVisibilityScore");
    expect(publicPage).toContain("data.visibilityScore");
    expect(publicPage).not.toMatch(/综合评分\\s*\(\\d\+\)/);
  });
});
