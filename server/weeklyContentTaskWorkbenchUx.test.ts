import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-WeeklyContent-TaskWorkbench-UX-P0", () => {
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const board = read("client/src/components/weekly/PlatformContentBoard.tsx");
  const taskCard = read("client/src/components/weekly/WeeklyContentTaskControlCard.tsx");
  const detailSheet = read("client/src/components/weekly/WeeklyContentDetailSheet.tsx");
  const publishableList = read("client/src/components/weekly/WeeklyPublishableContentList.tsx");
  const auxiliary = read("client/src/components/weekly/WeeklyAuxiliarySections.tsx");
  const collapsible = read("client/src/components/weekly/WeeklyCollapsibleSection.tsx");
  const queueBlock = read("client/src/components/weekly/WeeklyPublishQueueStatusBlock.tsx");
  const assistant = read("client/src/components/weekly/ContentProductionAssistantPanel.tsx");
  const shell = read("client/src/components/project/EnterpriseProjectShell.tsx");
  const statusLib = read("shared/weeklyContentTaskStatus.ts");

  it("首屏任务总控卡与平台看板", () => {
    expect(weekly).toContain("weekly-platform-content-page");
    expect(weekly).toContain("内容生产与发布准备");
    expect(weekly).toContain("WeeklyContentTaskControlCard");
    expect(weekly).toContain("WeeklyPublishQueueStatusBlock");
    expect(queueBlock).toContain("去发布中心");
    expect(taskCard).toContain("当前内容任务");
    expect(weekly).toContain("PlatformContentBoard");
    expect(board).toContain("平台发布计划");
    expect(board).toContain("weekly-platform-status-");
  });

  it("完整正文不默认大面积展开", () => {
    expect(detailSheet).toContain("weekly-detail-full-body");
    expect(detailSheet).toContain("展开全文");
    expect(detailSheet).toContain("<details");
    expect(weekly).not.toContain("weekly-section-generated-content");
    expect(weekly).toContain("WeeklyContentDetailSheet");
  });

  it("辅助信息默认折叠", () => {
    expect(auxiliary).toContain("平台规则");
    expect(auxiliary).toContain("AI 实测跟踪");
    expect(auxiliary).toContain("内容模板库");
    expect(auxiliary).toContain("历史内容记录");
    expect(collapsible).toMatch(/open=\{defaultOpen \? undefined : false\}/);
    expect(weekly).toContain("WeeklyAuxiliarySections");
  });

  it("平台卡片显示状态与操作", () => {
    expect(board).toContain("weeklyContentTaskStatusLabel");
    expect(board).toContain("生成平台稿");
    expect(board).toContain("查看内容");
    expect(board).toContain("加入发布队列");
    expect(statusLib).toContain("UNGENERATED");
    expect(statusLib).toContain("PUBLISH_READY");
  });

  it("可发布内容列表与右侧面板", () => {
    expect(publishableList).toContain("待处理内容");
    expect(publishableList).toContain("人工审核");
    expect(publishableList).toContain("暂无待审核内容");
    expect(weekly).toContain("WeeklyPublishableContentList");
    expect(assistant).toContain("下一步");
    expect(shell).toContain("ContentProductionAssistantPanel");
    expect(shell).toContain("isWeeklyPage");
  });

  it("空任务状态与交互保留", () => {
    expect(weekly).toContain("暂无内容任务");
    expect(weekly).toContain("weekly-select-content-gap");
    expect(board).toContain("weekly-primary-");
    expect(weekly).toContain("requestEnqueuePublish");
    expect(taskCard).toContain("weekly-go-enqueue-content");
    expect(weekly).not.toContain("rawAnswer");
    expect(weekly).not.toContain("taskId:");
    expect(weekly).not.toMatch(/\bprovider\b/);
    expect(weekly).not.toMatch(/\bmock\b/);
    expect(weekly).not.toMatch(/\bschema\b/);
  });

  it("副标题与业务文案", () => {
    expect(weekly).toContain("围绕 AI 推荐短板生成内容，审核后适配平台并加入发布队列");
    expect(auxiliary).not.toMatch(/Prompt 写入规则/);
  });
});
