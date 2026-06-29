import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.2 content publishing task queue UX P0", () => {
  const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
  const statusBar = read("client/src/components/publishing/PublishStatusBar.tsx");
  const queueTable = read("client/src/components/publishing/PublishTaskQueueTable.tsx");
  const operatorOverview = read("client/src/components/publishing/PublishOperatorOverview.tsx");
  const executionTabs = read("client/src/lib/publishExecutionTabs.ts");
  const assistant = read("client/src/components/publishing/PublishAssistantPanel.tsx");
  const publishUi = page + statusBar + queueTable + executionTabs + assistant;
  const shell = read("client/src/components/project/EnterpriseProjectShell.tsx");
  const viewModel = read("client/src/lib/buildPublishingViewModel.ts");

  it("第一屏展示发布状态总览与任务队列", () => {
    const overviewIdx = page.indexOf("<PublishStatusBar");
    const queueIdx = page.indexOf('data-testid="publish-task-queue-module"');
    expect(overviewIdx).toBeGreaterThan(-1);
    expect(queueIdx).toBeGreaterThan(overviewIdx);
    expect(statusBar).toContain("发布状态总览");
    expect(statusBar).toContain('data-testid="publish-status-overview"');
    expect(statusBar).toContain("本地发布助手状态");
    expect(statusBar).toContain("可发布账号数");
    expect(statusBar).toContain("待发布任务数");
    expect(statusBar).toContain("发布失败数量");
  });

  it("V2.3-P0-H 第一屏升级为代理运营发布总览", () => {
    const operatorIdx = page.indexOf("<PublishOperatorOverview");
    const statusIdx = page.indexOf("<PublishStatusBar");
    const queueIdx = page.indexOf('data-testid="publish-task-queue-module"');
    expect(operatorIdx).toBeGreaterThan(-1);
    expect(statusIdx).toBeGreaterThan(operatorIdx);
    expect(queueIdx).toBeGreaterThan(statusIdx);
    expect(operatorOverview).toContain("今天最该处理的发布工作");
    expect(page).toContain("待发布内容");
    expect(page).toContain("已发布待验证");
    expect(page).toContain("账号可用平台");
    expect(page).toContain("异常/待处理平台");
    expect(operatorOverview).toContain('data-testid="publish-pending-task-operator-list"');
    expect(operatorOverview).toContain('data-testid="publish-account-operator-status"');
    expect(operatorOverview).toContain('data-testid="publish-published-verification"');
    for (const internalToken of ["questionId", "sourceType", "projectId", "workflow", "bundle", "commit"]) {
      expect(operatorOverview).not.toContain(internalToken);
    }
  });

  it("默认 Tab 按发布成功 / 待回填 / 待发布优先级切换", () => {
    expect(page).toContain("resolveDefaultPublishExecutionTab");
    expect(page).toContain('value={executionTab}');
    expect(executionTabs).toContain("resolveDefaultPublishExecutionTab");
    expect(executionTabs).toContain("publish-queue-tab-pending");
    expect(executionTabs).toContain("待发布");
    expect(executionTabs).toContain("publish-queue-tab-waiting-links");
    expect(executionTabs).toContain("待回填链接");
  });

  it("账号与客户端模块默认折叠", () => {
    for (const testId of [
      "publish-account-client-fold",
      "publish-local-agent-download-fold",
      "publish-advanced-diagnostics-fold",
      "publish-success-rate-fold",
      "publish-calendar-fold",
    ]) {
      expect(page).toContain(`data-testid="${testId}"`);
    }
    expect(page).not.toContain("FirstUseHintBanner");
    expect(page).not.toContain("PublishAccountSessionAlert");
    expect(page).not.toContain("publish-waiting-links-banner");
  });

  it("发布页右侧仅展示执行摘要字段", () => {
    expect(shell).toContain("PublishAssistantPanel");
    expect(assistant).toContain("待发布任务数");
    expect(assistant).toContain("发布失败数");
    expect(assistant).toContain("客户端连接状态");
    expect(assistant).toContain("待回填链接数");
    expect(assistant).not.toContain("增长建议");
  });

  it("空任务状态包含原因、下一步与去生成按钮", () => {
    expect(page).toContain("PUBLISH_EXECUTION_EMPTY_HINTS");
    expect(executionTabs).toContain("当前没有待发布任务");
    expect(page).toContain("去生成新内容");
    expect(page).toContain("publish-empty-view-published");
    expect(page).toContain("publish-empty-go-inclusion");
  });

  it("右侧摘要展示最近发布与下一步", () => {
    expect(assistant).toContain("最近发布");
    expect(assistant).toContain("下一步");
    expect(assistant).toContain("暂无发布记录");
    expect(assistant).toContain("resolveRecentPublishSidebarSummary");
  });

  it("页面打开按项目自动检测 Local Agent 并尝试同步账号", () => {
    expect(page).toMatch(/initialAgentCheckProjectRef/);
    expect(page).toMatch(/runAccountHealthCheck\(\{ detectSessions: true \}\)/);
    expect(publishUi).toContain("刷新账号状态");
    expect(publishUi).toContain("打开客户端");
  });

  it("保留错误边界且视图模型纯派生", () => {
    expect(page).toContain("PublishCenterErrorBoundary");
    expect(page).toContain("buildPublishingViewModel");
    expect(viewModel).not.toContain("useEffect");
    expect(viewModel).toContain("needs_attention");
  });

  it("客户化标题与任务表操作", () => {
    expect(page).toContain("发布执行中心");
    expect(page).toContain("PublishTaskQueueTable");
    expect(queueTable).toContain("发送到客户端");
    expect(queueTable).toContain("查看任务");
    expect(queueTable).toContain("回填链接");
    expect(queueTable).toContain("标记失败");
  });

  it("发布记录位于折叠账号与客户端区域内", () => {
    const foldIdx = page.indexOf('data-testid="publish-account-client-fold"');
    const recordsIdx = page.indexOf("recentLimit={10}");
    expect(foldIdx).toBeGreaterThan(-1);
    expect(recordsIdx).toBeGreaterThan(foldIdx);
  });
});
