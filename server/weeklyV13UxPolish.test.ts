import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.3-Weekly-UX-Polish", () => {
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const queueBlock = read("client/src/components/weekly/WeeklyPublishQueueStatusBlock.tsx");
  const statusBar = read("client/src/components/weekly/WeeklyContentStatusBar.tsx");
  const preview = read("client/src/components/weekly/WeeklyContentPreviewPanel.tsx");
  const publishableList = read("client/src/components/weekly/WeeklyPublishableContentList.tsx");
  const board = read("client/src/components/weekly/PlatformContentBoard.tsx");
  const auxiliary = read("client/src/components/weekly/WeeklyAuxiliarySections.tsx");
  const detailSheet = read("client/src/components/weekly/WeeklyContentDetailSheet.tsx");
  const collapsible = read("client/src/components/weekly/WeeklyCollapsibleSection.tsx");

  it("发布队列状态块", () => {
    expect(weekly).toContain("WeeklyPublishQueueStatusBlock");
    expect(queueBlock).toContain("待回填链接");
  });

  it("顶部任务状态条", () => {
    expect(weekly).toContain("TaskContextHero");
    expect(read("client/src/components/weekly/ContentTaskProgressionView.tsx")).toContain("task-progression-hero");
    expect(read("client/src/components/weekly/ContentTaskProgressionView.tsx")).toContain("当前优化问题");
    expect(weekly).toContain("contentTaskViewQuery");
  });

  it("内容预览区折叠与展开全文", () => {
    expect(weekly).toContain("MotherArticleSummaryCard");
    expect(read("client/src/components/weekly/ContentTaskProgressionView.tsx")).toContain("查看全文");
    expect(detailSheet).toContain("展开全文");
    expect(detailSheet).toContain("weekly-detail-full-body");
    expect(detailSheet).toContain("<details");
  });

  it("待处理内容卡片式列表", () => {
    expect(publishableList).toContain("weekly-publishable-card-list");
    expect(publishableList).toContain("weekly-publishable-card-");
    expect(publishableList).toContain("查看详情");
    expect(publishableList).toContain("审核内容");
    expect(publishableList).not.toContain("<table");
  });

  it("平台发布计划两列卡片", () => {
    expect(board).toContain("平台发布计划");
    expect(board).toContain("sm:grid-cols-2");
    expect(board).toContain("平台稿状态");
    expect(board).toContain("账号状态");
    expect(board).toContain("生成平台稿");
    expect(board).toContain("查看内容");
  });

  it("默认折叠模块", () => {
    expect(weekly).toContain("高级内容增强");
    expect(weekly).toContain("weekly-aux-generation-log");
    expect(weekly).toContain("weekly-aux-full-body");
    expect(auxiliary).toContain("历史内容记录");
    expect(auxiliary).toContain("AI 实测跟踪");
    expect(auxiliary).toContain("平台规则");
    expect(auxiliary).toContain("内容模板库");
    expect(collapsible).toMatch(/open=\{defaultOpen \? undefined : false\}/);
  });
});
