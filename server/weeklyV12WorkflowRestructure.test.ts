import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.2-Weekly-Workflow-Restructure-P0", () => {
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const publishableList = read("client/src/components/weekly/WeeklyPublishableContentList.tsx");
  const reviewDialog = read("client/src/components/weekly/WeeklyContentReviewConfirmDialog.tsx");
  const localAgentBar = read("client/src/components/weekly/WeeklyLocalAgentStatusBar.tsx");
  const assistant = read("client/src/components/weekly/ContentProductionAssistantPanel.tsx");
  const taskCard = read("client/src/components/weekly/WeeklyContentTaskControlCard.tsx");
  const board = read("client/src/components/weekly/PlatformContentBoard.tsx");
  const auxiliary = read("client/src/components/weekly/WeeklyAuxiliarySections.tsx");
  const collapsible = read("client/src/components/weekly/WeeklyCollapsibleSection.tsx");

  it("weekly page title and three-screen structure", () => {
    expect(weekly).toContain("GEO 内容生产工作台");
    expect(weekly).toContain("WeeklyContentTaskControlCard");
    expect(weekly).toContain("WeeklyPublishableContentList");
    expect(weekly).toContain("PlatformContentBoard");
    expect(taskCard).toContain("本轮任务总览");
    expect(publishableList).toContain("待处理内容");
    expect(board).toContain("平台发布计划");
  });

  it("pending content list has four tabs", () => {
    expect(publishableList).toContain("weekly-tab-pending-review");
    expect(publishableList).toContain("weekly-tab-enqueue-ready");
    expect(publishableList).toContain("weekly-tab-queued");
    expect(publishableList).toContain("weekly-tab-needs-modify");
    expect(publishableList).toContain("待审核");
    expect(publishableList).toContain("可入队");
    expect(publishableList).toContain("已入队");
    expect(publishableList).toContain("需修改");
  });

  it("does not show Local Agent download module in weekly main flow", () => {
    const mainSection = weekly.slice(
      weekly.indexOf("weekly-platform-content-page"),
      weekly.indexOf("publish-to-platform-dialog"),
    );
    expect(mainSection).toContain("WeeklyLocalAgentStatusBar");
    expect(mainSection).not.toContain("<LocalAgentConnectionPanel");
    expect(mainSection).not.toContain("weekly-publish-strong-cta");
    expect(localAgentBar).toContain("去发布执行中心处理");
  });

  it("manual review column and review-and-enqueue flow", () => {
    expect(publishableList).toContain("人工审核");
    expect(publishableList).toContain("审核内容");
    expect(read("shared/weeklyPublishableDisplay.ts")).toContain("审核并加入队列");
    expect(reviewDialog).toContain("确认人工审核");
    expect(reviewDialog).toContain("weekly-review-confirm-checkbox");
    expect(weekly).toContain("reviewAndEnqueueArticle.mutateAsync");
    expect(weekly).toContain("handleReviewConfirmSubmit");
  });

  it("assistant panel shows weekly-specific fields only", () => {
    expect(assistant).toContain("待审核内容");
    expect(assistant).toContain("可入队内容");
    expect(assistant).toContain("缺封面内容");
    expect(assistant).toContain("下一步动作");
    expect(assistant).not.toContain("风险提醒");
    expect(assistant).not.toContain("最近数据");
    expect(assistant).not.toContain("去发布队列");
  });

  it("auxiliary sections collapsed and inclusion hint", () => {
    expect(auxiliary).toContain("平台规则");
    expect(auxiliary).toContain("内容模板库");
    expect(collapsible).toMatch(/open=\{defaultOpen \? undefined : false\}/);
    expect(auxiliary).toContain("收录复测中心");
    expect(auxiliary).toContain("T1/T2/T3");
  });

  it("main work area appears before platform generation board", () => {
    const publishableIdx = weekly.indexOf("WeeklyPublishableContentList");
    const boardIdx = weekly.indexOf("<PlatformContentBoard");
    expect(publishableIdx).toBeGreaterThan(-1);
    expect(boardIdx).toBeGreaterThan(publishableIdx);
  });
});
