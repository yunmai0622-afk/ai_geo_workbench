export const CUSTOMER_COMPANY_STATUSES = ["pending", "active", "rejected", "disabled"] as const;
export type CustomerCompanyStatus = (typeof CUSTOMER_COMPANY_STATUSES)[number];

export const USER_REVIEW_STATUSES = ["pending_review", "active", "rejected", "disabled"] as const;
export type UserReviewStatus = (typeof USER_REVIEW_STATUSES)[number];

export const CUSTOMER_ROLES = ["customer_admin", "customer_member"] as const;
export type CustomerRole = (typeof CUSTOMER_ROLES)[number];

export const COMPANY_PLAN_TYPES = ["trial", "basic", "pro", "agency", "custom"] as const;
export type CompanyPlanType = (typeof COMPANY_PLAN_TYPES)[number];

export const COMPANY_SUBSCRIPTION_STATUSES = ["trial", "active", "expired", "paused", "cancelled"] as const;
export type CompanySubscriptionStatus = (typeof COMPANY_SUBSCRIPTION_STATUSES)[number];

export const RENEWAL_RISK_LEVELS = ["low", "medium", "high"] as const;
export type RenewalRiskLevel = (typeof RENEWAL_RISK_LEVELS)[number];

export const PLATFORM_FEATURE_KEYS = [
  "aiDiagnosis",
  "monthlyPlan",
  "contentGeneration",
  "sourceDiscovery",
  "trustEvidence",
  "publishing",
  "inclusionRetest",
  "monthlyReport",
  "localAgent",
] as const;
export type PlatformFeatureKey = (typeof PLATFORM_FEATURE_KEYS)[number];

export const DEFAULT_ENABLED_FEATURES: Record<PlatformFeatureKey, boolean> = {
  aiDiagnosis: true,
  monthlyPlan: true,
  contentGeneration: true,
  sourceDiscovery: true,
  trustEvidence: true,
  publishing: true,
  inclusionRetest: true,
  monthlyReport: true,
  localAgent: false,
};

export type PlanTypeDefaults = {
  planName: string;
  maxProjects: number;
  monthlyAiTests: number;
  monthlyContentTasks: number;
  monthlyReports: number;
  maxTeamMembers: number;
  enabledFeatures: Record<PlatformFeatureKey, boolean>;
};

export const PLAN_TYPE_DEFAULTS: Record<CompanyPlanType, PlanTypeDefaults> = {
  trial: {
    planName: "试用版",
    maxProjects: 1,
    monthlyAiTests: 5,
    monthlyContentTasks: 10,
    monthlyReports: 1,
    maxTeamMembers: 3,
    enabledFeatures: {
      ...DEFAULT_ENABLED_FEATURES,
      localAgent: false,
      publishing: false,
    },
  },
  basic: {
    planName: "基础版",
    maxProjects: 1,
    monthlyAiTests: 10,
    monthlyContentTasks: 20,
    monthlyReports: 1,
    maxTeamMembers: 5,
    enabledFeatures: { ...DEFAULT_ENABLED_FEATURES, localAgent: false },
  },
  pro: {
    planName: "专业版",
    maxProjects: 3,
    monthlyAiTests: 30,
    monthlyContentTasks: 60,
    monthlyReports: 2,
    maxTeamMembers: 10,
    enabledFeatures: { ...DEFAULT_ENABLED_FEATURES },
  },
  agency: {
    planName: "代运营版",
    maxProjects: 10,
    monthlyAiTests: 100,
    monthlyContentTasks: 200,
    monthlyReports: 4,
    maxTeamMembers: 20,
    enabledFeatures: { ...DEFAULT_ENABLED_FEATURES },
  },
  custom: {
    planName: "定制版",
    maxProjects: 5,
    monthlyAiTests: 50,
    monthlyContentTasks: 100,
    monthlyReports: 2,
    maxTeamMembers: 15,
    enabledFeatures: { ...DEFAULT_ENABLED_FEATURES },
  },
};

export const CUSTOMER_COMPANY_STATUS_LABELS: Record<CustomerCompanyStatus, string> = {
  pending: "待审核",
  active: "服务中",
  rejected: "已拒绝",
  disabled: "已禁用",
};

export const USER_REVIEW_STATUS_LABELS: Record<UserReviewStatus, string> = {
  pending_review: "待审核",
  active: "已通过",
  rejected: "已拒绝",
  disabled: "已禁用",
};

export const CUSTOMER_ROLE_LABELS: Record<CustomerRole, string> = {
  customer_admin: "客户管理员",
  customer_member: "客户成员",
};

export const COMPANY_PLAN_TYPE_LABELS: Record<CompanyPlanType, string> = {
  trial: "试用版",
  basic: "基础版",
  pro: "专业版",
  agency: "旗舰版",
  custom: "定制版",
};

export const COMPANY_SUBSCRIPTION_STATUS_LABELS: Record<CompanySubscriptionStatus, string> = {
  trial: "试用中",
  active: "服务中",
  expired: "已到期",
  paused: "已暂停",
  cancelled: "已取消",
};

export const RENEWAL_RISK_LABELS: Record<RenewalRiskLevel, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

export const PLATFORM_FEATURE_LABELS: Record<PlatformFeatureKey, string> = {
  aiDiagnosis: "AI 实测诊断",
  monthlyPlan: "本月优化计划",
  contentGeneration: "内容生成",
  sourceDiscovery: "AI 自动发现信源",
  trustEvidence: "信任证据库",
  publishing: "平台发布",
  inclusionRetest: "收录复测",
  monthlyReport: "月度报告",
  localAgent: "Local Agent",
};

export function daysUntil(date: Date | string | null | undefined, now: Date = new Date()): number | null {
  if (!date) return null;
  const target = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function parseEnabledFeatures(raw: unknown): Record<PlatformFeatureKey, boolean> {
  const base = { ...DEFAULT_ENABLED_FEATURES };
  if (!raw || typeof raw !== "object") return base;
  for (const key of PLATFORM_FEATURE_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "boolean") base[key] = value;
  }
  return base;
}

export function isPlatformAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

export function isOperatorRole(role: string | null | undefined): boolean {
  return role === "operator";
}

/** 可进入运营后台（客户/项目）：平台管理员或代运营 */
export function canAccessOperatorAdminConsole(role: string | null | undefined): boolean {
  return isPlatformAdminRole(role) || isOperatorRole(role);
}

export type PlatformActor = {
  userId: number;
  role: string;
};

export function resolveCustomerCompanyOwnerUserId(actor: PlatformActor): number | undefined {
  if (isPlatformAdminRole(actor.role)) return undefined;
  if (isOperatorRole(actor.role)) return actor.userId;
  return undefined;
}

export type RenewalRiskInput = {
  subscriptionStatus: CompanySubscriptionStatus | null;
  expiresAt: Date | string | null | undefined;
  monthlyPlanCompletedRate: number | null;
  hasAiTestData: boolean;
  hasMonthlyReport: boolean;
  now?: Date;
};

export function computeRenewalRisk(input: RenewalRiskInput): RenewalRiskLevel {
  const now = input.now ?? new Date();
  const days = daysUntil(input.expiresAt, now);
  const isExpired =
    input.subscriptionStatus === "expired" ||
    input.subscriptionStatus === "cancelled" ||
    (days != null && days < 0);

  if (isExpired || (days != null && days <= 7)) return "high";

  const completionRate = input.monthlyPlanCompletedRate ?? 1;
  if (days != null && days <= 30 && completionRate < 0.3) return "high";

  if (!input.hasAiTestData || !input.hasMonthlyReport) return "medium";

  return "low";
}

export type CompanyServiceStatus = {
  companyId: number | null;
  hasSubscription: boolean;
  planType: CompanyPlanType | null;
  planName: string | null;
  status: CompanySubscriptionStatus | null;
  expiresAt: Date | null;
  daysRemaining: number | null;
  isServiceActive: boolean;
  bannerMessage: string | null;
};
