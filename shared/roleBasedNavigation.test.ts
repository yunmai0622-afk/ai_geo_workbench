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
    title: "主流程",
    items: [
      { path: "/workspace", label: "项目工作台" },
      { path: "/enterprise-profile", label: "品牌资产建档" },
      { path: "/ai-diagnosis", label: "AI 实测诊断" },
      { path: "/maturity", label: "AI 品牌成熟度" },
      { path: "/monthly-plan", label: "本月优化计划" },
      { path: "/weekly", label: "内容生产工作台" },
      { path: "/content-publishing", label: "平台适配发布" },
      { path: "/inclusion-monitoring", label: "内容资产效果" },
      { path: "/delivery-reports", label: "AI 品牌成熟度月报" },
    ],
  },
  {
    title: "资产管理",
    items: [
      { path: "/questions", label: "问题库" },
      { path: "/brand-source-graph", label: "品牌信源图谱" },
    ],
  },
  {
    title: "设置",
    items: [{ path: "/knowledge", label: "使用指南" }],
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
    expect(groups).toHaveLength(3);
    expect(groups[0]?.items).toHaveLength(9);
  });

  it("shows client-only main flow navigation for brand customers", () => {
    const groups = filterNavGroupsForRole(sampleGroups, false);
    expect(countVisibleNavItems(sampleGroups, false)).toBe(CLIENT_NAV_PATHS.length);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBe("主流程");
    expect(groups[0]?.items.map(item => item.path)).toEqual([...CLIENT_NAV_PATHS]);
  });
});
