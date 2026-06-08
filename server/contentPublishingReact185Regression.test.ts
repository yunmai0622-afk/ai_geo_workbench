import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 content publishing React #185 regression", () => {
  const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
  const healthHook = read("client/src/hooks/usePublishAccountHealthCheck.ts");
  const boundary = read("client/src/components/publishing/PublishCenterErrorBoundary.tsx");
  const viewModel = read("client/src/lib/buildPublishingViewModel.ts");

  it("wraps publish page with a local error boundary and load-failure hint", () => {
    expect(page).toContain("PublishCenterErrorBoundary");
    expect(page).toContain("ContentPublishingCenterPageInner");
    expect(boundary).toContain("publish-center-render-fallback");
    expect(boundary).toContain("发布状态暂时无法加载，请稍后重试");
    expect(page).toContain("publish-center-load-failed");
    expect(page).toContain("发布状态暂时无法加载，请稍后重试");
  });

  it("derives publish state via pure view model instead of effect setState", () => {
    expect(page).toContain("buildPublishingViewModel");
    expect(viewModel).toContain("export function buildPublishingViewModel");
    expect(viewModel).not.toContain("useEffect");
    expect(viewModel).not.toContain("useState");
    expect(page).toContain("return changed ? next : prev");
    expect(page).not.toContain("setManualArticleId(publishableArticles[0]");
    expect(page).toContain("manualArticleSelectValue");
  });

  it("does not auto-run account health, local agent probe, or task polling on mount", () => {
    const statusBar = read("client/src/components/publishing/PublishStatusBar.tsx");
    expect(healthHook).not.toContain("useEffect");
    expect(healthHook).not.toContain("autoRunKeyRef");
    expect(healthHook).toContain("setAgentOnline(prev => (prev === online ? prev : online))");
    expect(page).not.toContain("setInterval");
    expect(page).not.toContain("checkLocalAgentHealth");
    expect(page).toContain("<PublishStatusBar");
    expect(statusBar).toContain('data-testid="publish-queue-refresh"');
    expect(statusBar).toContain("立即拉取任务");
  });

  it("guards local agent online state updates and exposes debug logging", () => {
    const connHook = read("client/src/hooks/useLocalAgentConnection.ts");
    expect(page).toContain("useLocalAgentConnection");
    expect(connHook).toContain("checkLocalAgentHealth");
    expect(connHook).not.toContain("useEffect");
    expect(page).toContain("[GEO content-publishing debug]");
    expect(page).toContain('get("debug") === "1"');
    expect(page).toContain("lastUserAction");
  });

  it("renders platform status overview and success rate panels from cached queries", () => {
    expect(page).toContain("PlatformStatusOverview");
    expect(page).toContain("PlatformPublishSuccessRatePanel");
    expect(read("client/src/components/platformAccounts/PlatformStatusOverview.tsx")).toContain("平台状态总览");
    expect(read("client/src/components/platformAccounts/PlatformStatusOverview.tsx")).toContain(
      "platform-status-overview",
    );
  });

  it("supports project-scoped publish URL path", () => {
    expect(read("client/src/App.tsx")).toContain('path="/content-publishing"');
    expect(page).toContain("projectId: selectedProjectId!");
    expect(page).toContain("enabled: enabled && Boolean(selectedProjectId)");
  });

  it("includes runtime React #185 acceptance script", () => {
    const script = read("scripts/content_publishing_react185_acceptance.mjs");
    expect(script).toContain("content_publishing_react185_acceptance");
    expect(script).toContain("waitForTimeout(10000)");
    expect(script).toContain("consoleErrors");
    expect(script).toContain("pageerror");
    expect(script).toContain("React #185");
    expect(script).toContain("平台适配发布");
    expect(script).toContain("publish-ready-refresh");
  });
});
