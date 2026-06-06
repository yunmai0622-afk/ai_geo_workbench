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
  const assistant = read("client/src/components/weekly/ContentProductionAssistantPanel.tsx");
  const shell = read("client/src/components/project/EnterpriseProjectShell.tsx");
  const statusLib = read("shared/weeklyContentTaskStatus.ts");

  it("首屏任务总控卡与平台看板", () => {
    expect(weekly).toContain("weekly-platform-content-page");
    expect(weekly).toContain("内容生产与审核工作台");
    expect(weekly).toContain("WeeklyContentTaskControlCard");
    expect(taskCard).toContain("本轮内容任务总览");
    expect(weekly).toContain("PlatformContentBoard");
    expect(board).toContain("平台内容看板");
    expect(board).toContain("weekly-platform-status-");
  });

  it("完整正文不默认大面积展开", () => {
    expect(detailSheet).toContain("weekly-detail-full-body");
    expect(detailSheet).toContain("查看完整正文");
    expect(detailSheet).toContain("<details");
    expect(weekly).not.toContain("weekly-section-generated-content");
    expect(weekly).toContain("WeeklyContentDetailSheet");
  });

  it("辅助信息默认折叠", () => {
    expect(auxiliary).toContain("查看平台规则");
    expect(auxiliary).toContain("AI 可见度目标");
    expect(auxiliary).toContain("查看内容模板库");
    expect(auxiliary).toContain("历史内容记录");
    expect(auxiliary).toMatch(/open=\{defaultOpen \? undefined : false\}/);
    expect(weekly).toContain("WeeklyAuxiliarySections");
  });

  it("平台卡片显示状态与操作", () => {
    expect(board).toContain("weeklyContentTaskStatusLabel");
    expect(board).toContain("生成该平台内容");
    expect(board).toContain("查看内容");
    expect(board).not.toContain("加入发布队列");
    expect(statusLib).toContain("UNGENERATED");
    expect(statusLib).toContain("PUBLISH_READY");
  });

  it("可发布内容列表与右侧面板", () => {
    expect(publishableList).toContain("可发布内容");
    expect(publishableList).toContain("人工审核");
    expect(publishableList).toContain("暂无可发布内容");
    expect(weekly).toContain("WeeklyPublishableContentList");
    expect(assistant).toContain("内容审核助手");
    expect(shell).toContain("ContentProductionAssistantPanel");
    expect(shell).toContain("isWeeklyPage");
  });

  it("空任务状态与交互保留", () => {
    expect(weekly).toContain("暂无内容任务");
    expect(weekly).toContain("weekly-select-content-gap");
    expect(board).toContain("weekly-generate-");
    expect(weekly).toContain("requestEnqueuePublish");
    expect(taskCard).toContain("weekly-go-publishing-queue");
    expect(weekly).not.toContain("rawAnswer");
    expect(weekly).not.toContain("taskId:");
    expect(weekly).not.toMatch(/\bprovider\b/);
    expect(weekly).not.toMatch(/\bmock\b/);
    expect(weekly).not.toMatch(/\bschema\b/);
  });

  it("副标题与业务文案", () => {
    expect(weekly).toContain("根据 AI 诊断缺口生成平台化内容，完成质检与人工审核后加入发布队列");
    expect(auxiliary).not.toMatch(/Prompt 写入规则/);
  });
});
