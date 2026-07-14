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
    ]) {
      expect(page).toContain(marker);
    }
  });

  it("keeps the first-screen metrics customer-readable", () => {
    for (const label of ["AI 品牌资产总分", "AI 是否知道你", "AI 是否愿意推荐你", "本月资产建设进度"]) {
      expect(page).toContain(label);
    }
    for (const label of ["当前最大问题", "查看本月服务计划"]) {
      expect(page).toContain(label);
    }
    expect(page).not.toContain("workspace-monthly-top3");
  });

  it("does not expose operational details on the customer homepage", () => {
    expect(page).not.toContain('data-testid="workspace-operator-details"');
    expect(page).not.toContain("运营详情，仅内部参考");
    expect(page).not.toContain("默认关闭，不进入客户第一轮演示");
    expect(page).not.toContain("WorkspaceDashboardOverviewCards");
    expect(page).not.toContain("WorkspaceInclusionMonitoringSection");
    expect(page).not.toContain("questionId=");
    expect(page).not.toContain("sourceType=");
    expect(page).not.toContain("taskId=");
    expect(page).not.toContain("ownerUserId");
  });
});
