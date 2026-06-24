/**
 * GEO-V2.1-P2：品牌客户 vs 代运营/管理员左侧导航分层（纯展示逻辑）
 */

export const OPERATOR_NAV_MAIN_FLOW_COUNT = 9;
export const OPERATOR_NAV_ASSET_COUNT = 2;
export const OPERATOR_NAV_SETTINGS_COUNT = 1;
export const OPERATOR_NAV_TOTAL_COUNT =
  OPERATOR_NAV_MAIN_FLOW_COUNT + OPERATOR_NAV_ASSET_COUNT + OPERATOR_NAV_SETTINGS_COUNT;

/** 品牌客户可见的主流程入口（5 项） */
export const CLIENT_NAV_PATHS = [
  "/workspace",
  "/ai-diagnosis",
  "/monthly-plan",
  "/inclusion-monitoring",
  "/delivery-reports",
] as const;

export type NavGroupLike<TItem extends { path: string }> = {
  title: string;
  items: TItem[];
};

/** 代运营/管理员：users.role === "admin" */
export function resolveNavOperatorMode(userRole: string | null | undefined): boolean {
  return userRole === "admin";
}

export function filterNavGroupsForRole<TItem extends { path: string }>(
  groups: NavGroupLike<TItem>[],
  isOperator: boolean,
): NavGroupLike<TItem>[] {
  if (isOperator) return groups;
  const allowed = new Set<string>(CLIENT_NAV_PATHS);
  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => allowed.has(item.path)),
    }))
    .filter(group => group.items.length > 0);
}

export function countVisibleNavItems<TItem extends { path: string }>(
  groups: NavGroupLike<TItem>[],
  isOperator: boolean,
): number {
  return filterNavGroupsForRole(groups, isOperator).reduce((sum, group) => sum + group.items.length, 0);
}
