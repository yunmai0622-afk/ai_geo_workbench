import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO V2.3 P0-B workspace customer overview", () => {
  const page = read("client/src/pages/EnterpriseWorkspacePage.tsx");

  it("turns /workspace into a customer-facing GEO service homepage", () => {
    for (const marker of [
      "客户可见",
      "GEO 服务首页",
      "当前 AI 可见度结论",
      "workspace-customer-conclusion",
      "workspace-core-metrics",
      "workspace-top-issues",
      "workspace-service-flow",
      "workspace-recent-progress",
      "workspace-customer-risks",
      "workspace-primary-cta",
      "workspace-operator-details",
    ]) {
      expect(page).toContain(marker);
    }
  });

  it("keeps the first-screen metrics customer-readable", () => {
    for (const label of ["AI 成熟度", "AI 是否知道你", "AI 是否愿意推荐你", "本月服务进度"]) {
      expect(page).toContain(label);
    }
    for (const label of ["当前最大问题", "查看本月服务计划"]) {
      expect(page).toContain(label);
    }
    expect(page).not.toContain("workspace-monthly-top3");
  });

  it("keeps operational details behind detail entries instead of the customer first screen", () => {
    expect(page).toContain("运营详情，仅内部参考");
    expect(page).toContain("默认关闭，不进入客户第一轮演示");
    expect(page).toContain("WorkspaceDashboardOverviewCards");
    expect(page).toContain("WorkspaceInclusionMonitoringSection");
    expect(page).not.toContain("questionId=");
    expect(page).not.toContain("sourceType=");
    expect(page).not.toContain("taskId=");
    expect(page).not.toContain("ownerUserId");
  });
});
