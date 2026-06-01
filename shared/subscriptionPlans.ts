/** GEO 订阅套餐（展示用，暂不接入支付） */
export type SubscriptionPlanId = "basic" | "professional" | "enterprise";

export const SUBSCRIPTION_PLAN_IDS = ["basic", "professional", "enterprise"] as const satisfies readonly SubscriptionPlanId[];

export function parseSubscriptionPlanId(value: unknown): SubscriptionPlanId | null {
  if (value === "basic" || value === "professional" || value === "enterprise") return value;
  return null;
}

export type SubscriptionPlanDisplay = {
  id: SubscriptionPlanId;
  name: string;
  priceLabel: string;
  priceNote?: string;
  projectLimitLabel: string;
  featureSummary: string;
  ctaLabel: string;
  highlighted?: boolean;
};

export const DEFAULT_SUBSCRIPTION_PLAN_ID: SubscriptionPlanId = "basic";

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlanDisplay[] = [
  {
    id: "basic",
    name: "基础版",
    priceLabel: "免费",
    projectLimitLabel: "1 个项目",
    featureSummary: "基础功能：客户管理、企业档案、AI 诊断与内容生产核心流程",
    ctaLabel: "免费开始",
  },
  {
    id: "professional",
    name: "专业版",
    priceLabel: "¥299",
    priceNote: "/ 月",
    projectLimitLabel: "5 个项目",
    featureSummary: "全部功能：含内容发布、收录监测、交付报告与多项目协作",
    ctaLabel: "即将开放",
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "企业版",
    priceLabel: "联系我们",
    projectLimitLabel: "不限项目（按合同约定）",
    featureSummary: "专属部署、定制集成、SLA 与专属客户成功支持",
    ctaLabel: "联系商务",
  },
] as const;

export const SUBSCRIPTION_CONTACT_EMAIL = "contact@example.com";

export function getSubscriptionPlanById(planId: SubscriptionPlanId): SubscriptionPlanDisplay {
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
  if (!plan) return SUBSCRIPTION_PLANS[0];
  return plan;
}

/** 客户端缺省展示：未拉取到服务端套餐快照时使用基础版 */
export function resolveUserSubscriptionPlanId(): SubscriptionPlanId {
  return DEFAULT_SUBSCRIPTION_PLAN_ID;
}
