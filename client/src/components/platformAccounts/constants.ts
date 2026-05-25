import type { AccountGroupType } from "@shared/contentStrategy";
import type { PublishIdentity } from "@shared/contentStrategy";

export type SidebarGroupKey = "all" | "ungrouped" | AccountGroupType;

export const SIDEBAR_GROUPS: { key: SidebarGroupKey; label: string }[] = [
  { key: "all", label: "全部账号" },
  { key: "ad_group", label: "默认分组" },
  { key: "official_group", label: "官方账号组" },
  { key: "seeding_group", label: "种草账号组" },
  { key: "employee_group", label: "员工账号组" },
  { key: "matrix_group", label: "矩阵号组" },
  { key: "ungrouped", label: "未分组" },
];

export type SessionFilter = "all" | "active" | "expired" | "unknown";

export const SESSION_FILTER_OPTIONS: { value: SessionFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "active", label: "登录有效" },
  { value: "expired", label: "已失效" },
  { value: "unknown", label: "未检测" },
];

export type IdentityFilter = "all" | PublishIdentity;

export const IDENTITY_FILTER_OPTIONS: { value: IdentityFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "official", label: "官方号" },
  { value: "third_party", label: "种草号" },
  { value: "employee", label: "员工号" },
  { value: "matrix", label: "矩阵号" },
];

export function matchesSidebarGroup(accountGroup: string | null, key: SidebarGroupKey): boolean {
  if (key === "all") return true;
  if (key === "ungrouped") return !accountGroup?.trim();
  return accountGroup === key;
}

export function matchesSessionFilter(sessionStatus: string | null, filter: SessionFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return sessionStatus === "active";
  if (filter === "expired") return sessionStatus === "expired";
  return sessionStatus !== "active" && sessionStatus !== "expired";
}

export function matchesIdentityFilter(accountRole: string | null, filter: IdentityFilter): boolean {
  if (filter === "all") return true;
  return accountRole === filter;
}
