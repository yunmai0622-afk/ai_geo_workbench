import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO V2.3 P0-B workspace customer overview", () => {
  const page = read("client/src/pages/EnterpriseWorkspacePage.tsx");

  it("turns /workspace into a customer-facing GEO service homepage", () => {
    for (const marker of [
      "客户总览 / GEO 服务首页",
      "一句话结论",
      "workspace-customer-conclusion",
      "workspace-core-metrics",
      "workspace-top-issues",
      "workspace-monthly-top3",
      "workspace-service-flow",
      "workspace-recent-progress",
      "workspace-customer-risks",
      "workspace-primary-cta",
    ]) {
      expect(page).toContain(marker);
    }
  });

  it("keeps the first-screen metrics customer-readable", () => {
    for (const label of ["AI 成熟度", "AI 是否知道你", "AI 是否愿意推荐你", "本月服务进度"]) {
      expect(page).toContain(label);
    }
    for (const label of ["当前最大 3 个问题", "本月 Top 3 服务事项", "怎么看效果"]) {
      expect(page).toContain(label);
    }
  });

  it("keeps operational details behind detail entries instead of the customer first screen", () => {
    expect(page).toContain("查看诊断、成熟度与运营详情");
    expect(page).toContain("WorkspaceDashboardOverviewCards");
    expect(page).toContain("WorkspaceInclusionMonitoringSection");
    expect(page).not.toContain("questionId=");
    expect(page).not.toContain("sourceType=");
    expect(page).not.toContain("taskId=");
    expect(page).not.toContain("ownerUserId");
  });
});
