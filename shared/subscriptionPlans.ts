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
  /** 定价页与设置页展示的套餐要点（与后端实际配额/权限一致） */
  features: readonly string[];
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
    features: [
      "T0 检测最多 3 次",
      "内容生成最多 10 篇",
      "仅限 1 个项目",
      "客户管理、企业档案、AI 诊断与内容生产核心流程",
    ],
    ctaLabel: "免费开始",
  },
  {
    id: "professional",
    name: "专业版",
    priceLabel: "¥299",
    priceNote: "/ 月",
    projectLimitLabel: "5 个项目",
    features: ["无内容生成上限", "5 个项目", "优先支持"],
    ctaLabel: "即将开放",
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "企业版",
    priceLabel: "联系我们",
    projectLimitLabel: "不限项目（按合同约定）",
    features: ["专属部署、定制集成", "SLA 与专属客户成功支持"],
    ctaLabel: "联系商务",
  },
] as const;

export const SUBSCRIPTION_CONTACT_EMAIL = "523245782@qq.com";

export function getSubscriptionPlanById(planId: SubscriptionPlanId): SubscriptionPlanDisplay {
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
  if (!plan) return SUBSCRIPTION_PLANS[0];
  return plan;
}

/** 客户端缺省展示：未拉取到服务端套餐快照时使用基础版 */
export function resolveUserSubscriptionPlanId(): SubscriptionPlanId {
  return DEFAULT_SUBSCRIPTION_PLAN_ID;
}
