import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf-8");

describe("delivery report visual hierarchy (C3-A / C3-B)", () => {
  const customerView = readProjectFile("client/src/components/DeliveryReportCustomerView.tsx");
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

  it("renders five customer-facing sections with core labels", () => {
    for (const text of [
      "AI 搜索可见度评分",
      "AI 搜索实测结果",
      "查看完整证据",
      "查看文章",
      "暂无证据",
    ]) {
      expect(customerView).toContain(text);
    }
    expect(displayLib).toMatch(/join\(" \/ "\)/);
    expect(flow).toContain("DeliveryReportsCenterPage");
    expect(readProjectFile("client/src/pages/DeliveryReportsCenterPage.tsx")).toContain("delivery-report-page");
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
