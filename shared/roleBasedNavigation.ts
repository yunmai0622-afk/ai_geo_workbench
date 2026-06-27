/**
 * GEO-V2.3-P0-A：客户主流程 vs 代理运营工具左侧导航分层（纯展示逻辑）
 */

export const OPERATOR_NAV_MAIN_FLOW_COUNT = 6;
export const OPERATOR_NAV_TOOL_COUNT = 6;
export const OPERATOR_NAV_TOTAL_COUNT = OPERATOR_NAV_MAIN_FLOW_COUNT + OPERATOR_NAV_TOOL_COUNT;

/** 品牌客户可见的主流程入口（6 项） */
export const CLIENT_NAV_PATHS = [
  "/workspace",
  "/ai-diagnosis",
  "/monthly-plan",
  "/weekly",
  "/inclusion-monitoring",
  "/delivery-reports",
] as const;

export type NavGroupLike<TItem extends { path: string }> = {
  title: string;
  items: TItem[];
};

/** 代运营/管理员：users.role === "admin" | "operator" */
export function resolveNavOperatorMode(userRole: string | null | undefined): boolean {
  return userRole === "admin" || userRole === "operator";
}

export function filterNavGroupsForRole<TItem extends { path: string }>(
  groups: NavGroupLike<TItem>[],
  isOperator: boolean,
): NavGroupLike<TItem>[] {
  if (isOperator) return groups;
  const allowed = new Set<string>(CLIENT_NAV_PATHS);
  const seen = new Set<string>();
  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!allowed.has(item.path) || seen.has(item.path)) return false;
        seen.add(item.path);
        return true;
      }),
    }))
    .filter(group => group.items.length > 0);
}

export function countVisibleNavItems<TItem extends { path: string }>(
  groups: NavGroupLike<TItem>[],
  isOperator: boolean,
): number {
  return filterNavGroupsForRole(groups, isOperator).reduce((sum, group) => sum + group.items.length, 0);
}
