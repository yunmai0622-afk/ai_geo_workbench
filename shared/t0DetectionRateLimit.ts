import type { SubscriptionPlanId } from "./subscriptionPlans";

/** professional / enterprise 套餐 T0 每小时上限（开发验收友好） */
export const PROFESSIONAL_T0_DETECTION_PER_HOUR_LIMIT = 5;

export type T0DetectionHourlyLimitInput = {
  isAdmin: boolean;
  planId: SubscriptionPlanId;
  /** 系统配置的基础版默认上限（通常为 1 次/小时） */
  configuredBasicLimit: number;
};

/**
 * 解析 T0 检测每小时限流次数。
 * - 管理员：null（完全豁免）
 * - professional / enterprise：5 次/小时
 * - basic：使用系统配置
 */
export function resolveT0DetectionPerHourLimit(input: T0DetectionHourlyLimitInput): number | null {
  if (input.isAdmin) return null;
  if (input.planId === "professional" || input.planId === "enterprise") {
    return PROFESSIONAL_T0_DETECTION_PER_HOUR_LIMIT;
  }
  return input.configuredBasicLimit;
}
