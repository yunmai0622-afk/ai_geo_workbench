import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.1-P2 Role-Based Navigation", () => {
  it("filters sidebar nav by admin role without changing routes", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    const shared = read("shared/roleBasedNavigation.ts");
    expect(layout).toContain("filterNavGroupsForRole");
    expect(layout).toContain("resolveNavOperatorMode");
    expect(layout).toContain("resolveNavOperatorMode(user?.role)");
    expect(layout).not.toContain('visibleNavGroups = navGroups');
    expect(layout).toContain("sidebar-nav-operator");
    expect(layout).toContain("sidebar-nav-client");
    expect(shared).toContain("CLIENT_NAV_PATHS");
    expect(shared).toContain('userRole === "admin"');
  });

  it("keeps full nav item definitions for operator mode", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    for (const label of [
      "项目工作台",
      "品牌资产建档",
      "AI 实测诊断",
      "AI 品牌成熟度",
      "本月优化计划",
      "内容生产工作台",
      "平台适配发布",
      "内容资产效果",
      "AI 品牌成熟度月报",
      "问题库",
      "品牌信源图谱",
      "使用指南",
    ]) {
      expect(layout).toContain(`label: "${label}"`);
    }
  });
});
