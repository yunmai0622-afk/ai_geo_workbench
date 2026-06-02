import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 content publishing React #185 regression", () => {
  const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
  const healthHook = read("client/src/hooks/usePublishAccountHealthCheck.ts");
  const boundary = read("client/src/components/publishing/PublishCenterErrorBoundary.tsx");

  it("wraps publish page with a local error boundary and load-failure hint", () => {
    expect(page).toContain("PublishCenterErrorBoundary");
    expect(page).toContain("ContentPublishingCenterPageInner");
    expect(boundary).toContain("publish-center-render-fallback");
    expect(boundary).toContain("发布任务暂时无法加载，请稍后重试");
    expect(page).toContain("publish-center-load-failed");
  });

  it("normalizes API arrays with useMemo and stable link-draft updates", () => {
    expect(page).toContain("contentPublishingSafeData");
    expect(page).toContain("return changed ? next : prev");
    expect(page).not.toContain("setManualArticleId(publishableArticles[0]");
    expect(page).toContain("manualArticleSelectValue");
  });

  it("avoids query-object polling deps and one-shot account health auto sync", () => {
    expect(page).toContain("refetchAutoPublishTasks");
    expect(page).not.toContain("autoPublishTasksQuery]);");
    expect(healthHook).toContain("autoRunKeyRef");
    expect(healthHook).toContain("setAgentOnline(prev => (prev === online ? prev : online))");
  });

  it("guards local agent online state updates", () => {
    expect(page).toContain("setLocalAgentOnline(prev =>");
    expect(page).toContain("prev === accountHealthAgentOnline ? prev : accountHealthAgentOnline");
  });

  it("supports project-scoped publish URL path", () => {
    expect(read("client/src/App.tsx")).toContain('path="/content-publishing"');
    expect(page).toContain("projectId: selectedProjectId!");
    expect(page).toContain("enabled: enabled && Boolean(selectedProjectId)");
  });
});
