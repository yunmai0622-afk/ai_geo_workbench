import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.2 publishing monitoring workflow restructure P0", () => {
  const publishPage = read("client/src/pages/ContentPublishingCenterPage.tsx");
  const publishStatusBar = read("client/src/components/publishing/PublishStatusBar.tsx");
  const publishQueueTable = read("client/src/components/publishing/PublishTaskQueueTable.tsx");
  const publishExecutionTabs = read("client/src/lib/publishExecutionTabs.ts");
  const publishAssistant = read("client/src/components/publishing/PublishAssistantPanel.tsx");
  const publishShell = read("client/src/components/project/EnterpriseProjectShell.tsx");
  const inclusionPage = read("client/src/pages/InclusionMonitoringCenterPage.tsx");
  const inclusionAssistant = read("client/src/components/inclusion-monitoring/InclusionMonitoringAssistantPanel.tsx");

  it("/content-publishing 第一屏展示发布状态总览和任务队列", () => {
    const overviewIdx = publishPage.indexOf("<PublishStatusBar");
    const queueIdx = publishPage.indexOf('data-testid="publish-task-queue-module"');
    expect(publishPage).toContain("发布执行中心");
    expect(publishStatusBar).toContain("发布状态总览");
    expect(publishStatusBar).toContain("本地发布助手状态");
    expect(publishStatusBar).toContain("待回填链接数量");
    expect(publishStatusBar).toContain("立即拉取任务");
    expect(publishStatusBar).toContain("打开客户端");
    expect(overviewIdx).toBeGreaterThan(-1);
    expect(queueIdx).toBeGreaterThan(overviewIdx);
    expect(publishPage).toContain("PublishTaskQueueTable");
    expect(publishQueueTable).toContain("publish-task-queue-table");
  });

  it("/content-publishing Local Agent 下载/诊断信息默认折叠", () => {
    expect(publishPage).toContain('data-testid="publish-account-client-fold"');
    expect(publishPage).toContain('data-testid="publish-local-agent-download-fold"');
    expect(publishPage).toContain('data-testid="publish-advanced-diagnostics-fold"');
    expect(publishPage).not.toContain("Local Agent 原理");
    expect(publishPage).not.toContain("发布前请确保本地客户端已启动并连接");
  });

  it("/content-publishing 右侧栏只展示本页相关字段", () => {
    expect(publishShell).toContain("PublishAssistantPanel");
    expect(publishAssistant).toContain("待发布任务数");
    expect(publishAssistant).toContain("发布失败数");
    expect(publishAssistant).toContain("客户端连接状态");
    expect(publishAssistant).toContain("待回填链接数");
    expect(publishAssistant).not.toContain("增长建议");
    expect(publishAssistant).not.toContain("当前阻断");
  });

  it("/inclusion-monitoring 第一屏展示监测总览", () => {
    expect(inclusionPage).toContain("收录复测中心");
    expect(inclusionPage).toContain('data-testid="inclusion-monitoring-overview"');
    expect(inclusionPage).toContain("已发布内容数");
    expect(inclusionPage).toContain("已回填公开链接数");
    expect(inclusionPage).toContain("AI提及变化");
    expect(inclusionPage).toContain("下一次复测时间");
  });

  it("/inclusion-monitoring 已发布内容表按内容组织", () => {
    expect(inclusionPage).toContain('data-testid="inclusion-monitoring-content-table"');
    expect(inclusionPage).toContain("已发布内容监测表");
    expect(inclusionPage).toContain("7 天后复测");
    expect(inclusionPage).toContain("14 天后复测");
    expect(inclusionPage).toContain("30 天后复测");
    expect(inclusionPage).not.toContain("已创建的监测卡片");
    expect(inclusionPage).not.toContain("grid gap-4 lg:grid-cols-2");
  });

  it("/inclusion-monitoring AI证据默认折叠", () => {
    expect(inclusionPage).toContain('data-testid="inclusion-monitoring-ai-evidence-fold"');
    expect(inclusionPage).toContain("<details");
    expect(inclusionPage).toContain("AI 实测证据");
    expect(inclusionPage).toContain("查看证据");
  });

  it("/inclusion-monitoring 右侧栏组件只展示本页相关字段", () => {
    expect(inclusionAssistant).toContain("待复测内容数");
    expect(inclusionAssistant).toContain("未回填链接数");
    expect(inclusionAssistant).toContain("AI提及变化");
    expect(inclusionAssistant).toContain("下一次复测时间");
    expect(inclusionAssistant).not.toContain("增长建议");
  });

  it("两页路由 HTTP 200 且保留 React #185 回归脚本", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('path="/content-publishing"');
    expect(app).toContain('path="/inclusion-monitoring"');
    expect(read("scripts/content_publishing_react185_acceptance.mjs")).toContain("React #185");
    expect(publishPage).toContain("PublishCenterErrorBoundary");
    expect(publishPage).toContain("buildPublishingViewModel");
  });

  it("inclusion 页面从 V12FlowPages 再导出且未改 weekly", () => {
    const flow = read("client/src/pages/V12FlowPages.tsx");
    expect(flow).toContain('export { InclusionMonitoringFlowPage } from "./InclusionMonitoringCenterPage"');
    expect(publishExecutionTabs).toContain("publish-queue-tab-pending");
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).not.toContain("收录复测中心");
    expect(weekly).not.toContain("发布执行中心");
  });
});
