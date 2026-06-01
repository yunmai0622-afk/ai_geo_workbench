import { PUBLISH_PLATFORM_LABELS, type BindingPublishPlatform } from "./platformAccountVerify";
import { resolveQuestionTypeDisplayLabel } from "./retestComparisonDisplay";

export const QUESTION_TEMPLATE_PLATFORMS = ["zhihu", "sohu", "baijiahao", "toutiao", "netease"] as const;
export type QuestionTemplatePlatform = (typeof QUESTION_TEMPLATE_PLATFORMS)[number];

export type QuestionTemplateVariables = {
  brand: string;
  product: string;
  targetCustomer: string;
  industry: string;
  coreAdvantage: string;
};

export type BuiltinQuestionTemplateSeed = {
  slug: string;
  platform: QuestionTemplatePlatform;
  questionType: string;
  title: string;
  promptTemplate: string;
  description: string;
};

export const BUILTIN_QUESTION_TEMPLATES: readonly BuiltinQuestionTemplateSeed[] = [
  {
    slug: "zhihu-brand-awareness",
    platform: "zhihu",
    questionType: "品牌认知",
    title: "知乎品牌问答模板",
    promptTemplate: "{brand}是做什么的？核心产品是{product}，主要服务{targetCustomer}",
    description: "适用于知乎问答场景，帮助读者快速理解品牌定位与核心产品。",
  },
  {
    slug: "sohu-industry-intro",
    platform: "sohu",
    questionType: "行业推荐",
    title: "搜狐号行业介绍模板",
    promptTemplate: "{brand}：{industry}领域的{coreAdvantage}",
    description: "适用于搜狐号资讯稿开头，突出行业归属与核心优势。",
  },
  {
    slug: "baijiahao-pain-point",
    platform: "baijiahao",
    questionType: "痛点解决",
    title: "百家号痛点解答模板",
    promptTemplate: "很多{targetCustomer}都在问：{brand}能否解决{industry}场景下的核心痛点？答案是围绕{coreAdvantage}提供可验证方案。",
    description: "适用于百家号长文，从客户痛点切入再引出品牌方案。",
  },
  {
    slug: "zhihu-competitor-compare",
    platform: "zhihu",
    questionType: "竞品对比",
    title: "知乎选型对比模板",
    promptTemplate: "在{industry}领域选型时，{brand}的核心差异在于{coreAdvantage}，更适合{targetCustomer}。",
    description: "适用于知乎对比类回答，客观说明品牌适配边界。",
  },
  {
    slug: "sohu-scenario-need",
    platform: "sohu",
    questionType: "scenario_need",
    title: "搜狐号场景需求模板",
    promptTemplate: "当{targetCustomer}面临{industry}场景下的增长瓶颈时，{brand}通过{product}提供可执行路径。",
    description: "适用于搜狐号场景指南类稿件。",
  },
] as const;

export function resolveQuestionTemplatePlatformLabel(platform: string): string {
  if ((QUESTION_TEMPLATE_PLATFORMS as readonly string[]).includes(platform)) {
    return PUBLISH_PLATFORM_LABELS[platform as BindingPublishPlatform];
  }
  return platform;
}

export function resolveQuestionTemplateTypeLabel(questionType: string): string {
  return resolveQuestionTypeDisplayLabel(questionType);
}

export function fillQuestionTemplatePrompt(template: string, vars: QuestionTemplateVariables): string {
  return template
    .replaceAll("{brand}", vars.brand)
    .replaceAll("{product}", vars.product)
    .replaceAll("{targetCustomer}", vars.targetCustomer)
    .replaceAll("{industry}", vars.industry)
    .replaceAll("{coreAdvantage}", vars.coreAdvantage);
}

export function buildQuestionTemplateVariables(input: {
  brand?: string | null;
  product?: string | null;
  targetCustomer?: string | null;
  industry?: string | null;
  coreAdvantage?: string | null;
}): QuestionTemplateVariables {
  return {
    brand: (input.brand ?? "").trim() || "（品牌名）",
    product: (input.product ?? "").trim() || "（核心产品）",
    targetCustomer: (input.targetCustomer ?? "").trim() || "（目标客户）",
    industry: (input.industry ?? "").trim() || "（行业）",
    coreAdvantage: (input.coreAdvantage ?? "").trim() || "（核心优势）",
  };
}

export function groupQuestionTemplatesByPlatform<T extends { platform: string }>(templates: T[]): Array<{ platform: string; label: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const item of templates) {
    const bucket = map.get(item.platform) ?? [];
    bucket.push(item);
    map.set(item.platform, bucket);
  }
  return QUESTION_TEMPLATE_PLATFORMS.filter(platform => map.has(platform)).map(platform => ({
    platform,
    label: resolveQuestionTemplatePlatformLabel(platform),
    items: map.get(platform) ?? [],
  }));
}

export function groupQuestionTemplatesByQuestionType<T extends { questionType: string }>(templates: T[]): Array<{ questionType: string; label: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const item of templates) {
    const bucket = map.get(item.questionType) ?? [];
    bucket.push(item);
    map.set(item.questionType, bucket);
  }
  return Array.from(map.entries()).map(([questionType, items]) => ({
    questionType,
    label: resolveQuestionTemplateTypeLabel(questionType),
    items,
  }));
}
