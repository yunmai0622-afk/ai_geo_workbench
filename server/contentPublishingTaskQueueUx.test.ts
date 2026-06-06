import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 content publishing task queue UX P0", () => {
  const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
  const statusBar = read("client/src/components/publishing/PublishStatusBar.tsx");
  const assistant = read("client/src/components/publishing/PublishAssistantPanel.tsx");
  const publishUi = page + statusBar + assistant;
  const shell = read("client/src/components/project/EnterpriseProjectShell.tsx");
  const connHook = read("client/src/hooks/useLocalAgentConnection.ts");
  const healthHook = read("client/src/hooks/usePublishAccountHealthCheck.ts");
  const viewModel = read("client/src/lib/buildPublishingViewModel.ts");

  it("第一屏展示顶部发布状态条与待发布任务区", () => {
    const statusIdx = page.indexOf("<PublishStatusBar");
    const queueIdx = page.indexOf('data-testid="publish-task-queue-module"');
    expect(statusIdx).toBeGreaterThan(-1);
    expect(queueIdx).toBeGreaterThan(-1);
    expect(statusIdx).toBeLessThan(queueIdx);
    expect(statusBar).toContain('data-testid="publish-status-bar"');
    expect(statusBar).toContain("本地客户端");
    expect(statusBar).toContain("可发布账号");
    expect(statusBar).toContain("待发布任务");
    expect(statusBar).toContain("异常任务");
  });

  it("默认 Tab 为待发布", () => {
    expect(page).toContain('defaultValue="pending"');
    expect(page).toContain("publish-queue-tab-pending");
    expect(page).toContain("待发布");
  });

  it("辅助模块默认折叠且不含 first-screen 重复状态块", () => {
    for (const testId of [
      "publish-platform-status-fold",
      "publish-success-rate-fold",
      "publish-platform-accounts-fold",
      "publish-local-agent-download-fold",
      "publish-calendar-fold",
      "publish-advanced-diagnostics-fold",
    ]) {
      expect(page).toContain(`data-testid="${testId}"`);
      expect(page).toContain("<details");
    }
    expect(page).not.toContain("FirstUseHintBanner");
    expect(page).not.toContain("PublishAccountSessionAlert");
    expect(page).not.toContain("PublishWeeklyOverviewBar");
    expect(page).not.toContain("publish-waiting-links-banner");
    expect(page).not.toContain("发布前请确保本地客户端已启动并连接");
  });

  it("发布页右侧仅展示发布助手，不展示增长建议", () => {
    expect(shell).toContain("PublishAssistantPanel");
    expect(shell).toContain('pathname === "/content-publishing"');
    expect(shell).toContain("isPublishPage");
    expect(shell).toContain("onPublishAccountBindCta");
    expect(shell).toContain("publishAssistantPanel");
    const publishBranch = shell.slice(
      shell.indexOf("const sidebarPanel = isPublishPage"),
      shell.indexOf("const sidebarPanel = isPublishPage") + 400,
    );
    expect(publishBranch).toContain("publishAssistantPanel");
    expect(publishBranch).not.toContain("GrowthSuggestionsPanel");
    expect(assistant).toContain("发布助手");
    expect(assistant).toContain("当前阻断");
    expect(assistant).toContain("下一步");
    expect(assistant).toContain("最近状态");
    expect(assistant).toContain("publish-assistant-bind-cta");
    expect(assistant).not.toContain("增长建议");
  });

  it("空任务状态包含原因、下一步与去生成按钮", () => {
    expect(page).toContain("PUBLISH_QUEUE_EMPTY_HINTS");
    expect(read("client/src/lib/contentPublishingSafeData.ts")).toContain(
      "当前项目还没有加入发布队列的内容",
    );
    expect(page).toContain("去生成/选择内容");
  });

  it("页面打开不自动检测 Local Agent 或刷新账号", () => {
    expect(connHook).not.toContain("useEffect");
    expect(healthHook).not.toContain("useEffect");
    expect(page).not.toMatch(/useEffect\(\(\) => \{[\s\S]{0,500}?checkLocalAgentHealth/);
    expect(page).not.toMatch(/useEffect\(\(\) => \{[\s\S]{0,500}?runAccountHealthCheck/);
    expect(publishUi).toContain("检测客户端连接");
    expect(publishUi).toContain("刷新账号状态");
  });

  it("保留错误边界且视图模型纯派生", () => {
    expect(page).toContain("PublishCenterErrorBoundary");
    expect(page).toContain("buildPublishingViewModel");
    expect(viewModel).not.toContain("useEffect");
    expect(viewModel).toContain("needs_attention");
  });

  it("客户化副标题与任务卡字段", () => {
    expect(page).toContain("将已确认的内容发送到本地发布助手");
    expect(page).toContain("账号和 Cookie 只保存在本机");
    expect(page).toContain("质检状态");
    expect(page).toContain("封面状态");
    expect(page).toContain("发送到客户端并完成发布确认");
    expect(page).toContain("回填链接");
    expect(page).toContain("标记人工发布");
  });

  it("发布记录展示最近 10 条且位于任务区下方", () => {
    const queueIdx = page.indexOf('data-testid="publish-task-queue-module"');
    const recordsIdx = page.indexOf("recentLimit={10}");
    expect(recordsIdx).toBeGreaterThan(queueIdx);
  });
});
