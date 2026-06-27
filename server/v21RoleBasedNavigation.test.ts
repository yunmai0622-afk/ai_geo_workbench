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
      "总览",
      "诊断",
      "本月方案",
      "执行进度",
      "效果验证",
      "效果报告",
      "品牌资料",
      "内容生产工作台",
      "发布执行中心",
      "AI 问题池",
      "信源与证据库",
      "使用指南",
    ]) {
      expect(layout).toContain(`label: "${label}"`);
    }
  });
});
