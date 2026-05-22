import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf-8");

describe("delivery report visual hierarchy (C3-A)", () => {
  const customerView = readProjectFile("client/src/components/DeliveryReportCustomerView.tsx");
  const displayLib = readProjectFile("client/src/lib/deliveryReportDisplay.ts");
  const flow = readProjectFile("client/src/pages/V12FlowPages.tsx");
  const share = readProjectFile("client/src/pages/DeliveryReportSharePage.tsx");
  const publicPage = readProjectFile("client/src/pages/DeliveryReportPublicPage.tsx");

  it("renders five customer-facing sections with core labels", () => {
    for (const text of [
      "AI 搜索可见度评分",
      "AI 搜索实测结果",
      "本轮发布内容",
      "下一步建议",
      "查看完整证据",
      "查看文章",
      "暂无证据",
    ]) {
      expect(customerView).toContain(text);
    }
    expect(displayLib).toMatch(/join\(" \/ "\)/);
    expect(customerView).toContain('title="发布前后复测对比"');
    expect(flow).toContain("DeliveryReportCustomerView");
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
    ]) {
      expect(customerView).not.toContain(forbidden);
    }
    expect(publicPage).not.toContain("复制客户报告链接");
    expect(publicPage).not.toContain("重新生成客户报告链接");
    expect(publicPage).not.toContain("禁用客户报告链接");
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
    expect(customerView).toContain("本轮发布内容");
    expect(customerView).toContain("查看文章");
    expect(customerView).toContain("本轮暂无发布记录");
    expect(readProjectFile("shared/deliveryReportPublicShare.ts")).toContain("publishedContent");
    expect(readProjectFile("server/deliveryReportPublicShare.ts")).toContain("mapRecordsToPublicPublishedContent");
  });
});
