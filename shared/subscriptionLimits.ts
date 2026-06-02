import { GEO_WEB_PATH_PRICING } from "./geoWebPaths";
import type { SubscriptionPlanId } from "./subscriptionPlans";
import { resolveUserSubscriptionPlanId } from "./subscriptionPlans";

/** 基础版配额 */
export const BASIC_PLAN_LIMITS = {
  maxProjects: 1,
  maxContentArticles: 10,
} as const;

/** 专业版配额（企业版项目数按合同约定，服务端不做硬顶） */
export const PROFESSIONAL_PLAN_LIMITS = {
  maxProjects: 5,
} as const;

export type SubscriptionLimitKind = "project" | "content_generation";

export const SUBSCRIPTION_LIMIT_BASIC_PROJECT_MESSAGE =
  "基础版最多可创建 1 个项目，如需更多项目请升级专业版。";

export const SUBSCRIPTION_LIMIT_PROFESSIONAL_PROJECT_MESSAGE =
  "专业版最多可创建 5 个项目，如需更多项目请联系商务升级企业版。";

/** @deprecated 使用 projectLimitMessageForPlan */
export const SUBSCRIPTION_LIMIT_PROJECT_MESSAGE = SUBSCRIPTION_LIMIT_BASIC_PROJECT_MESSAGE;

export const SUBSCRIPTION_LIMIT_CONTENT_MESSAGE =
  "基础版内容生成最多 10 篇，如需继续生成请升级专业版。";

/** @deprecated T0 检测配额已取消，保留常量仅兼容旧页面提示 */
export const SUBSCRIPTION_LIMIT_T0_MESSAGE = SUBSCRIPTION_LIMIT_CONTENT_MESSAGE;

export const SUBSCRIPTION_UPGRADE_PATH = GEO_WEB_PATH_PRICING;

const SUBSCRIPTION_LIMIT_MESSAGES = [
  SUBSCRIPTION_LIMIT_BASIC_PROJECT_MESSAGE,
  SUBSCRIPTION_LIMIT_PROFESSIONAL_PROJECT_MESSAGE,
  SUBSCRIPTION_LIMIT_CONTENT_MESSAGE,
] as const;

export function subscriptionLimitsExemptForRole(role: string): boolean {
  return role === "admin";
}

export function resolveMaxProjectsForPlan(planId: SubscriptionPlanId): number | null {
  switch (planId) {
    case "basic":
      return BASIC_PLAN_LIMITS.maxProjects;
    case "professional":
      return PROFESSIONAL_PLAN_LIMITS.maxProjects;
    case "enterprise":
      return null;
    default: {
      const _exhaustive: never = planId;
      return _exhaustive;
    }
  }
}

export function planHasContentArticleLimit(planId: SubscriptionPlanId): boolean {
  return planId === "basic";
}

export function projectLimitMessageForPlan(planId: SubscriptionPlanId): string {
  if (planId === "professional") return SUBSCRIPTION_LIMIT_PROFESSIONAL_PROJECT_MESSAGE;
  return SUBSCRIPTION_LIMIT_BASIC_PROJECT_MESSAGE;
}

export function isSubscriptionLimitMessage(message: string): boolean {
  const trimmed = message.trim();
  return SUBSCRIPTION_LIMIT_MESSAGES.some(item => item === trimmed);
}

export function subscriptionLimitMessageFor(
  kind: SubscriptionLimitKind,
  planId: SubscriptionPlanId = "basic",
): string {
  switch (kind) {
    case "project":
      return projectLimitMessageForPlan(planId);
    case "content_generation":
      return SUBSCRIPTION_LIMIT_CONTENT_MESSAGE;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** @deprecated 请使用 planHasContentArticleLimit / resolveMaxProjectsForPlan */
export function planAppliesBasicFreeLimits(planId: SubscriptionPlanId): boolean {
  return planId === "basic";
}

/** @deprecated 服务端请使用 resolveUserSubscriptionPlanIdFromDb；此处仅供无 DB 的客户端缺省 */
export function resolveSubscriptionPlanIdForUser(_userId?: number): SubscriptionPlanId {
  return resolveUserSubscriptionPlanId();
}
