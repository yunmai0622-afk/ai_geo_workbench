import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Weekly-Content-Review-Workbench-Refactor-P0", () => {
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const publishableList = read("client/src/components/weekly/WeeklyPublishableContentList.tsx");
  const reviewDialog = read("client/src/components/weekly/WeeklyContentReviewConfirmDialog.tsx");
  const detailSheet = read("client/src/components/weekly/WeeklyContentDetailSheet.tsx");
  const localAgentBar = read("client/src/components/weekly/WeeklyLocalAgentStatusBar.tsx");
  const assistant = read("client/src/components/weekly/ContentProductionAssistantPanel.tsx");
  const auxiliary = read("client/src/components/weekly/WeeklyAuxiliarySections.tsx");
  const taskCard = read("client/src/components/weekly/WeeklyContentTaskControlCard.tsx");
  const board = read("client/src/components/weekly/PlatformContentBoard.tsx");

  it("workbench title and four-section structure", () => {
    expect(weekly).toContain("内容生产与审核工作台");
    expect(weekly).toContain("WeeklyContentTaskControlCard");
    expect(weekly).toContain("PlatformContentBoard");
    expect(weekly).toContain("WeeklyPublishableContentList");
    expect(weekly).toContain("WeeklyContentDetailSheet");
    expect(taskCard).toContain("本轮内容任务总览");
    expect(board).toContain("平台内容看板");
  });

  it("does not show long body by default on main page", () => {
    expect(detailSheet).toContain("weekly-detail-full-body");
    expect(detailSheet).toContain("<details");
    expect(weekly).not.toContain("weekly-section-generated-content");
  });

  it("publishable table includes manual review column and enqueue labels", () => {
    const display = read("shared/weeklyPublishableDisplay.ts");
    expect(publishableList).toContain("人工审核");
    expect(publishableList).toContain("AI质检");
    expect(display).toContain("审核并加入队列");
    expect(publishableList).toContain("审核确认");
    expect(publishableList).toContain("weekly-publishable-manual-review-");
    expect(publishableList).toContain("weeklyEnqueueButtonLabel");
  });

  it("review confirm dialog blocks enqueue until checkbox confirmed", () => {
    expect(weekly).toContain("WeeklyContentReviewConfirmDialog");
    expect(reviewDialog).toContain("确认人工审核");
    expect(reviewDialog).toContain("weekly-review-confirm-checkbox");
    expect(reviewDialog).toContain("确认并加入发布队列");
    expect(weekly).toContain("requestEnqueuePublish");
    expect(weekly).toContain("handleReviewConfirmSubmit");
    expect(weekly).toContain("reviewAndEnqueueArticle.mutateAsync");
    expect(weekly).toContain("REVIEW_ENQUEUE_SUCCESS_MESSAGE");
  });

  it("AI QC reject cannot enqueue from list button kind", () => {
    expect(publishableList).toContain("blocked_qc");
    expect(publishableList).toContain("resolveWeeklyEnqueueButtonKind");
  });

  it("queued content shows already-queued state", () => {
    expect(read("shared/weeklyPublishableDisplay.ts")).toContain("已入队");
    expect(publishableList).toContain("queuedForPublish");
  });

  it("local agent download module removed from weekly main flow", () => {
    const mainSection = weekly.slice(
      weekly.indexOf("weekly-platform-content-page"),
      weekly.indexOf("publish-to-platform-dialog"),
    );
    expect(mainSection).toContain("WeeklyLocalAgentStatusBar");
    expect(mainSection).not.toContain("local-agent-publish-hint");
    expect(mainSection).not.toContain("<LocalAgentConnectionPanel");
    expect(localAgentBar).toContain("本地发布助手");
    expect(localAgentBar).toContain("去平台适配发布页处理");
  });

  it("auxiliary sections downgraded", () => {
    expect(auxiliary).toContain("查看平台规则");
    expect(auxiliary).toContain("查看内容模板库");
    expect(auxiliary).toContain("收录监测");
    expect(auxiliary).toMatch(/open=\{defaultOpen \? undefined : false\}/);
  });

  it("assistant panel shows task-relevant stats", () => {
    expect(assistant).toContain("待审核内容");
    expect(assistant).toContain("待入队内容");
    expect(assistant).toContain("未配置封面");
    expect(assistant).toContain("未绑定账号");
  });

  it("detail sheet has review and enqueue actions", () => {
    expect(detailSheet).toContain("标记已审核");
    expect(detailSheet).toContain("加入发布队列");
    expect(detailSheet).toContain("保存修改");
    expect(detailSheet).toContain("weekly-detail-mark-reviewed");
  });
});
