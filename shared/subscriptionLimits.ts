import { GEO_WEB_PATH_PRICING } from "./geoWebPaths";
import type { SubscriptionPlanId } from "./subscriptionPlans";
import { resolveUserSubscriptionPlanId } from "./subscriptionPlans";

/** 免费基础版（试用）配额 */
export const BASIC_PLAN_LIMITS = {
  maxProjects: 1,
  maxT0Detections: 3,
  maxContentArticles: 10,
} as const;

export type SubscriptionLimitKind = "project" | "t0_detection" | "content_generation";

export const SUBSCRIPTION_LIMIT_PROJECT_MESSAGE =
  "免费版最多可创建 1 个项目，如需更多项目请升级套餐。";

export const SUBSCRIPTION_LIMIT_T0_MESSAGE =
  "免费版 T0 基线检测最多可执行 3 次，如需继续检测请升级套餐。";

export const SUBSCRIPTION_LIMIT_CONTENT_MESSAGE =
  "免费版内容生成最多 10 篇，如需继续生成请升级套餐。";

export const SUBSCRIPTION_UPGRADE_PATH = GEO_WEB_PATH_PRICING;

const SUBSCRIPTION_LIMIT_MESSAGES = [
  SUBSCRIPTION_LIMIT_PROJECT_MESSAGE,
  SUBSCRIPTION_LIMIT_T0_MESSAGE,
  SUBSCRIPTION_LIMIT_CONTENT_MESSAGE,
] as const;

export function isSubscriptionLimitMessage(message: string): boolean {
  const trimmed = message.trim();
  return SUBSCRIPTION_LIMIT_MESSAGES.some(item => item === trimmed);
}

export function subscriptionLimitMessageFor(kind: SubscriptionLimitKind): string {
  switch (kind) {
    case "project":
      return SUBSCRIPTION_LIMIT_PROJECT_MESSAGE;
    case "t0_detection":
      return SUBSCRIPTION_LIMIT_T0_MESSAGE;
    case "content_generation":
      return SUBSCRIPTION_LIMIT_CONTENT_MESSAGE;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function planAppliesBasicFreeLimits(planId: SubscriptionPlanId): boolean {
  return planId === "basic";
}

export function resolveSubscriptionPlanIdForUser(_userId?: number): SubscriptionPlanId {
  return resolveUserSubscriptionPlanId();
}
