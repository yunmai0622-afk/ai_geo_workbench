import { describe, expect, it } from "vitest";
import {
  CLIENT_NAV_PATHS,
  countVisibleNavItems,
  filterNavGroupsForRole,
  OPERATOR_NAV_TOTAL_COUNT,
  resolveNavOperatorMode,
} from "./roleBasedNavigation";

const sampleGroups = [
  {
    title: "客户主流程",
    items: [
      { path: "/workspace", label: "总览" },
      { path: "/ai-diagnosis", label: "诊断" },
      { path: "/monthly-plan", label: "本月方案" },
      { path: "/weekly", label: "执行进度" },
      { path: "/inclusion-monitoring", label: "效果验证" },
      { path: "/delivery-reports", label: "效果报告" },
    ],
  },
  {
    title: "运营工具",
    items: [
      { path: "/enterprise-profile", label: "品牌资料" },
      { path: "/weekly?mode=content-production", label: "内容生产工作台" },
      { path: "/content-publishing", label: "发布执行中心" },
      { path: "/questions", label: "AI 问题池" },
      { path: "/brand-source-graph", label: "信源与证据库" },
      { path: "/knowledge", label: "使用指南" },
    ],
  },
];

describe("roleBasedNavigation", () => {
  it("treats admin role as operator navigation", () => {
    expect(resolveNavOperatorMode("admin")).toBe(true);
    expect(resolveNavOperatorMode("operator")).toBe(true);
    expect(resolveNavOperatorMode("user")).toBe(false);
    expect(resolveNavOperatorMode(undefined)).toBe(false);
  });

  it("shows full navigation for operators", () => {
    const groups = filterNavGroupsForRole(sampleGroups, true);
    expect(countVisibleNavItems(sampleGroups, true)).toBe(OPERATOR_NAV_TOTAL_COUNT);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.items).toHaveLength(6);
    expect(groups[1]?.items).toHaveLength(6);
  });

  it("shows client-only main flow navigation for brand customers", () => {
    const groups = filterNavGroupsForRole(sampleGroups, false);
    expect(countVisibleNavItems(sampleGroups, false)).toBe(CLIENT_NAV_PATHS.length);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBe("客户主流程");
    expect(groups[0]?.items.map(item => item.path)).toEqual([...CLIENT_NAV_PATHS]);
    expect(groups[0]?.items.map(item => item.label)).toEqual([
      "总览",
      "诊断",
      "本月方案",
      "执行进度",
      "效果验证",
      "效果报告",
    ]);
  });
});
