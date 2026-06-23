import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.3-Weekly-UX-Polish", () => {
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const queueBlock = read("client/src/components/weekly/WeeklyPublishQueueStatusBlock.tsx");
  const publishableList = read("client/src/components/weekly/WeeklyPublishableContentList.tsx");
  const board = read("client/src/components/weekly/PlatformContentBoard.tsx");
  const advanced = read("client/src/components/weekly/WeeklyAdvancedInfoSections.tsx");
  const detailSheet = read("client/src/components/weekly/WeeklyContentDetailSheet.tsx");
  const collapsible = read("client/src/components/weekly/WeeklyCollapsibleSection.tsx");

  it("发布队列状态块", () => {
    expect(queueBlock).toContain("待回填链接");
    expect(weekly).toContain("TaskProgressOverview");
  });

  it("顶部任务状态条", () => {
    expect(weekly).toContain("CurrentContentTaskCard");
    expect(read("client/src/components/weekly/ContentTaskProgressionView.tsx")).toContain("task-current-content-card");
    expect(read("client/src/components/weekly/ContentTaskProgressionView.tsx")).toContain("当前内容任务");
    expect(weekly).toContain("contentTaskViewQuery");
  });

  it("内容预览区折叠与展开全文", () => {
    expect(advanced).toContain("查看参考内容");
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

  it("平台任务板两列卡片", () => {
    expect(board).toContain("平台内容任务");
    expect(board).toContain("sm:grid-cols-2");
    expect(board).toContain("生成平台稿");
    expect(board).not.toContain("平台稿状态");
    expect(board).not.toContain("账号状态");
  });

  it("默认折叠模块", () => {
    expect(advanced).toContain("查看高级写作设置");
    expect(advanced).toContain("查看生成日志与诊断");
    expect(advanced).toContain("查看品牌与关键词依据");
    expect(advanced).toContain("历史内容记录");
    expect(collapsible).toMatch(/open=\{defaultOpen \? undefined : false\}/);
  });
});
