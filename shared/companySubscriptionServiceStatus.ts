import {
  daysUntil,
  type CompanySubscriptionStatus,
} from "./platformAdmin";

/** 面向客户展示的套餐服务状态（由时间与 DB 状态自动推断） */
export const SUBSCRIPTION_SERVICE_STATUSES = [
  "not_configured",
  "pending_start",
  "in_service",
  "expiring_soon",
  "expired",
  "paused",
] as const;

export type SubscriptionServiceStatus = (typeof SUBSCRIPTION_SERVICE_STATUSES)[number];

export const SUBSCRIPTION_SERVICE_STATUS_LABELS: Record<SubscriptionServiceStatus, string> = {
  not_configured: "未开通",
  pending_start: "待生效",
  in_service: "服务中",
  expiring_soon: "即将到期",
  expired: "已到期",
  paused: "已停用",
};

/** 套餐配置页可选类型：试用 / 基础 / 专业 / 旗舰 */
export const SUBSCRIPTION_CONFIG_PLAN_TYPES = ["trial", "basic", "pro", "agency"] as const;
export type SubscriptionConfigPlanType = (typeof SUBSCRIPTION_CONFIG_PLAN_TYPES)[number];

export type SubscriptionRecordLike = {
  status: CompanySubscriptionStatus;
  startedAt: Date | string;
  expiresAt: Date | string | null;
};

export function computeSubscriptionServiceStatus(
  subscription: SubscriptionRecordLike | null | undefined,
  now: Date = new Date(),
): SubscriptionServiceStatus {
  if (!subscription) return "not_configured";

  if (subscription.status === "paused" || subscription.status === "cancelled") {
    return "paused";
  }

  const startedAt = new Date(subscription.startedAt);
  if (!Number.isNaN(startedAt.getTime()) && startedAt.getTime() > now.getTime()) {
    return "pending_start";
  }

  const days = daysUntil(subscription.expiresAt, now);
  if (subscription.status === "expired" || (days != null && days < 0)) {
    return "expired";
  }
  if (days != null && days <= 30) {
    return "expiring_soon";
  }

  return "in_service";
}

export function isSubscriptionHighRenewalRisk(
  serviceStatus: SubscriptionServiceStatus,
  expiresAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (serviceStatus === "expired") return true;
  const days = daysUntil(expiresAt, now);
  if (days != null && days >= 0 && days <= 7) return true;
  return false;
}

export function subscriptionServiceStatusBadgeClass(status: SubscriptionServiceStatus): string {
  switch (status) {
    case "expiring_soon":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "expired":
      return "border-red-200 bg-red-50 text-red-800";
    case "in_service":
      return "border-green-200 bg-green-50 text-green-800";
    case "paused":
      return "border-gray-200 bg-gray-100 text-gray-700";
    case "pending_start":
      return "border-blue-200 bg-blue-50 text-blue-800";
    default:
      return "border-gray-200 bg-gray-50 text-gray-600";
  }
}

export function formatSubscriptionExpiryLabel(
  expiresAt: Date | string | null | undefined,
  serviceStatus: SubscriptionServiceStatus,
): string {
  if (serviceStatus === "not_configured") return "未配置";
  if (!expiresAt) return "未设置";
  return new Date(expiresAt).toLocaleDateString("zh-CN");
}
