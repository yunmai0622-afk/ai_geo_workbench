import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.3-P0-R remove workspace internal details", () => {
  const page = read("client/src/pages/EnterpriseWorkspacePage.tsx");

  it("keeps /workspace as a pure customer service homepage", () => {
    for (const marker of [
      "workspace-customer-conclusion",
      "workspace-service-flow",
      "workspace-recent-progress",
      "workspace-customer-risks",
      'label: "查看本月服务计划"',
    ]) {
      expect(page).toContain(marker);
    }
  });

  it("removes the internal reference entry from /workspace", () => {
    for (const removed of [
      'data-testid="workspace-operator-details"',
      "运营详情，仅内部参考",
      "默认关闭，不进入客户第一轮演示",
      "诊断详情、成熟度、趋势、监测明细和运营建议保留给内部交付复盘",
      "WorkspaceDashboardOverviewCards",
      "WorkspaceInclusionMonitoringSection",
    ]) {
      expect(page).not.toContain(removed);
    }
  });

  it("keeps operational backend pages available outside /workspace", () => {
    const app = read("client/src/App.tsx");
    for (const route of [
      'path="/ai-diagnosis"',
      'path="/questions"',
      'path="/brand-source-graph"',
      'path="/content-publishing"',
      'path="/weekly"',
    ]) {
      expect(app).toContain(route);
    }

    expect(read("client/src/pages/V12FlowPages.tsx")).toContain("AiDiagnosisFlowPage");
    expect(read("client/src/pages/QuestionsLibraryPage.tsx")).toContain("搜索问题挖掘");
    expect(read("client/src/pages/SourceGraphPage.tsx")).toContain("信源引用监测");
    expect(read("client/src/pages/ContentPublishingCenterPage.tsx")).toContain("发布执行中心");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("content-production");
  });
});
