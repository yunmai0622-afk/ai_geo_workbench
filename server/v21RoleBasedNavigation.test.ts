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
      "服务首页",
      "AI 能见度诊断",
      "月度优化计划",
      "执行进度",
      "收录与 AI 复测",
      "交付报告",
      "品牌资料",
      "内容生产与发布",
      "发布执行中心",
      "搜索问题挖掘",
      "信源引用监测",
      "使用指南",
    ]) {
      expect(layout).toContain(`label: "${label}"`);
    }
  });
});
