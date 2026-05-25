import type { AccountGroupType, ContentAssetType, PublishIdentity } from "./contentStrategy";
import { defaultRecommendedAccountGroup, defaultPublishIdentity } from "./contentStrategy";

/** 本轮支持的第三方发布平台（不含小红书发布，策略可预留） */
export const PUBLISH_PLATFORM_IDS = ["zhihu", "sohu", "toutiao", "baijiahao", "netease"] as const;

export type PublishPlatformId = (typeof PUBLISH_PLATFORM_IDS)[number];

export const AI_SEARCH_PLATFORM_OPTIONS = ["豆包", "Kimi", "DeepSeek"] as const;

export type AiSearchPlatform = (typeof AI_SEARCH_PLATFORM_OPTIONS)[number];

export const PLATFORM_CONTENT_TYPE_OPTIONS = [
  { value: "problem_solution", label: "问题回答型", strategyType: "problem_solution" as ContentAssetType },
  { value: "brand_awareness", label: "品牌认知型", strategyType: "brand_awareness" as ContentAssetType },
  { value: "case_story", label: "案例证明型", strategyType: "case_story" as ContentAssetType },
  { value: "methodology", label: "行业科普型", strategyType: "methodology" as ContentAssetType },
  { value: "competitor_compare", label: "竞品对比型", strategyType: "competitor_compare" as ContentAssetType },
  { value: "seeding", label: "种草推荐型", strategyType: "seeding" as ContentAssetType },
] as const;

export const GEO_ENHANCEMENT_GOAL_OPTIONS = [
  "提升品牌提及",
  "提升 AI 推荐",
  "补充案例证据",
  "覆盖目标问题",
  "对比竞品",
  "提升收录概率",
] as const;

export type GeoEnhancementGoal = (typeof GEO_ENHANCEMENT_GOAL_OPTIONS)[number];

export type PlatformContentRule = {
  id: PublishPlatformId;
  label: string;
  materialKey: string;
  summary: string;
  structureHints: string[];
  toneHints: string[];
  forbiddenPatterns: string[];
};

export const PLATFORM_CONTENT_RULES: Record<PublishPlatformId, PlatformContentRule> = {
  zhihu: {
    id: "zhihu",
    label: "知乎",
    materialKey: "知乎回答版",
    summary: "问题回答型：结构清楚、观点可信，适合长文与经验分享。",
    structureHints: [
      "开篇直接回应提问，避免媒体通稿式导语",
      "用「回答要点 / 判断依据 / 实操建议 / 案例或数据 / 小结」组织，而非资讯稿五段式",
      "每个小节要有可核验论据，可引用公开数据或脱敏案例",
    ],
    toneHints: ["第一人称经验或第三方观察者均可，但避免官腔通稿", "允许适度口语化，保持专业可信"],
    forbiddenPatterns: ["禁止只改标题不改结构", "禁止写成搜狐号式品牌通稿"],
  },
  sohu: {
    id: "sohu",
    label: "搜狐号",
    materialKey: "搜狐号版",
    summary: "品牌稿 / 行业分析型：标题正式，结构偏媒体稿，强调品牌实体与行业价值。",
    structureHints: [
      "标题偏正式、信息完整，突出行业与品牌实体",
      "采用「行业背景 / 品牌定位 / 能力拆解 / 客户价值 / 趋势判断」媒体稿结构",
      "避免知乎问答体、避免种草口语",
    ],
    toneHints: ["客观媒体叙述", "强调行业价值与品牌可信度"],
    forbiddenPatterns: ["禁止使用知乎问答开头", "禁止小红书式短段落堆叠"],
  },
  toutiao: {
    id: "toutiao",
    label: "头条号",
    materialKey: "头条号版",
    summary: "大众化表达、信息密度高，标题明确，适合知识科普与观点内容。",
    structureHints: [
      "标题直接点出读者收益或结论",
      "短段落 + 小标题，信息密度高，前 200 字给出核心观点",
      "用「核心观点 / 背景 / 方法 / 注意事项 / 总结」科普结构",
    ],
    toneHints: ["大众化、易扫读", "避免过长学术化段落"],
    forbiddenPatterns: ["禁止照搬知乎长问答结构", "禁止搜狐式过度正式通稿"],
  },
  baijiahao: {
    id: "baijiahao",
    label: "百家号",
    materialKey: "百家号版",
    summary: "搜索友好：结构清晰、品牌实体明确，强调问答覆盖与可信来源。",
    structureHints: [
      "H2 标题尽量贴近搜索问法",
      "显式写出品牌实体、服务边界、适用人群",
      "包含 FAQ 式小节，标注信息来源或核对方式",
    ],
    toneHints: ["克制、可检索", "强调可信来源与可验证表述"],
    forbiddenPatterns: ["禁止仅换标题的同质化正文", "禁止缺少品牌实体说明"],
  },
  netease: {
    id: "netease",
    label: "网易号",
    materialKey: "网易号版",
    summary: "资讯型 / 观点型：行业趋势 + 品牌观点，适合观察稿。",
    structureHints: [
      "以行业趋势或现象切入，再落到品牌观点",
      "采用「趋势观察 / 原因分析 / 方案讨论 / 品牌观点 / 读者行动」结构",
      "避免纯问答体或种草笔记体",
    ],
    toneHints: ["资讯观察 + 适度观点", "不夸大承诺"],
    forbiddenPatterns: ["禁止知乎问答体", "禁止头条式过度标题党"],
  },
};

/** 小红书策略预留（当前不进入发布平台下拉） */
export const XIAOHONGSHU_STRATEGY_RESERVE = {
  label: "小红书",
  structureHints: ["种草型", "场景感", "短段落", "强标题", "适合后续扩展"],
};

export type PlatformContentStrategyInput = {
  targetPublishPlatform: PublishPlatformId;
  contentStrategyType: ContentAssetType;
  publishIdentity: PublishIdentity;
  recommendedAccountGroup: AccountGroupType;
  targetQuestion: string;
  geoEnhancementGoal: GeoEnhancementGoal;
  targetAiPlatforms: AiSearchPlatform[];
};

export function isPublishPlatformId(value: string | null | undefined): value is PublishPlatformId {
  return Boolean(value && (PUBLISH_PLATFORM_IDS as readonly string[]).includes(value));
}

export function getPlatformRule(platformId: PublishPlatformId): PlatformContentRule {
  return PLATFORM_CONTENT_RULES[platformId];
}

export function formatPlatformRulesForPrompt(platformId: PublishPlatformId): string {
  const rule = getPlatformRule(platformId);
  return [
    `平台：${rule.label}`,
    rule.summary,
    "结构要求：",
    ...rule.structureHints.map(h => `- ${h}`),
    "表达要求：",
    ...rule.toneHints.map(h => `- ${h}`),
    "禁止：",
    ...rule.forbiddenPatterns.map(h => `- ${h}`),
  ].join("\n");
}

/** 各平台独立正文大纲（不得所有平台共用同一套 H2） */
export function getPlatformSpecificOutline(platformId: PublishPlatformId, brandName: string): string {
  const b = brandName;
  switch (platformId) {
    case "zhihu":
      return [
        "## 直接回答（先给结论，回应提问）",
        "## 判断依据（公开信息与可核验证据）",
        "## 实操建议（读者可执行的步骤）",
        `## 案例或数据参考（脱敏案例，自然提及「${b}」）`,
        "## 常见误区",
        "## 小结",
        "## 便于引用的要点（3-5 组 ### 问题 + 短答）",
        "## 更新说明",
        "## 发布后如何自行核对效果",
      ].join("\n");
    case "sohu":
      return [
        "## 行业背景与问题界定",
        `## 品牌实体与定位（正式介绍「${b}」）`,
        "## 能力与解决方案拆解",
        "## 客户价值与适用场景",
        "## 行业趋势判断",
        "## 客观小结（不作排名承诺）",
        "## 便于引用的要点（3-5 组 ### 问题 + 短答）",
        "## 更新说明",
      ].join("\n");
    case "toutiao":
      return [
        "## 核心观点（前段高密度信息）",
        "## 背景：为什么现在值得关注",
        "## 方法：如何理解与应对",
        `## 方案要点（自然提及「${b}」1-2 次）`,
        "## 注意事项",
        "## 总结",
        "## 便于引用的要点（3-5 组 ### 问题 + 短答）",
        "## 更新说明",
      ].join("\n");
    case "baijiahao":
      return [
        "## 搜索意图说明（对应目标问题）",
        `## 品牌与服务实体（明确「${b}」是谁）`,
        "## 问题拆解与解决路径",
        "## 证据与来源说明",
        "## 常见问答（FAQ）",
        "## 选择建议（客观、不承诺排名）",
        "## 便于引用的要点（3-5 组 ### 问题 + 短答）",
        "## 更新说明",
      ].join("\n");
    case "netease":
      return [
        "## 行业趋势观察",
        "## 变化背后的原因",
        "## 方案与路径讨论",
        `## 品牌观点（「${b}」的公开口径）`,
        "## 读者可执行的动作",
        "## 风险与边界说明",
        "## 便于引用的要点（3-5 组 ### 问题 + 短答）",
        "## 更新说明",
      ].join("\n");
    default:
      return getPlatformSpecificOutline("zhihu", brandName);
  }
}

export function buildDefaultPlatformStrategy(partial?: Partial<PlatformContentStrategyInput>): PlatformContentStrategyInput {
  return {
    targetPublishPlatform: partial?.targetPublishPlatform ?? "zhihu",
    contentStrategyType: partial?.contentStrategyType ?? "problem_solution",
    publishIdentity: partial?.publishIdentity ?? defaultPublishIdentity(),
    recommendedAccountGroup: partial?.recommendedAccountGroup ?? defaultRecommendedAccountGroup(),
    targetQuestion: partial?.targetQuestion?.trim() ?? "",
    geoEnhancementGoal: partial?.geoEnhancementGoal ?? "覆盖目标问题",
    targetAiPlatforms: partial?.targetAiPlatforms?.length
      ? partial.targetAiPlatforms
      : [...AI_SEARCH_PLATFORM_OPTIONS],
  };
}

export function validatePlatformContentStrategy(input: PlatformContentStrategyInput): string | null {
  if (!isPublishPlatformId(input.targetPublishPlatform)) return "请选择目标发布平台";
  if (!input.targetQuestion.trim()) return "请填写目标问题";
  if (!GEO_ENHANCEMENT_GOAL_OPTIONS.includes(input.geoEnhancementGoal)) return "请选择 GEO 增强目标";
  if (!input.targetAiPlatforms.length) return "请至少选择一个目标 AI 平台";
  return null;
}

export type PlatformContentStrategyMeta = PlatformContentStrategyInput & {
  targetPublishPlatformLabel: string;
  contentTypeLabel: string;
  platformRulesSummary: string;
  platformAdaptationNotes: string;
  geoQualitySelfCheckOutline: string;
};

export function buildPlatformContentStrategyMeta(input: PlatformContentStrategyInput): PlatformContentStrategyMeta {
  const rule = getPlatformRule(input.targetPublishPlatform);
  const typeLabel =
    PLATFORM_CONTENT_TYPE_OPTIONS.find(o => o.strategyType === input.contentStrategyType)?.label ??
    input.contentStrategyType;
  return {
    ...input,
    targetPublishPlatformLabel: rule.label,
    contentTypeLabel: typeLabel,
    platformRulesSummary: rule.summary,
    platformAdaptationNotes: [
      `本篇仅适配${rule.label}，采用该平台专属结构，不得与其它平台共用同一套正文。`,
      ...rule.structureHints,
    ].join(" "),
    geoQualitySelfCheckOutline:
      "生成后将自动运行 GEO 质量检查；请确认目标问题覆盖、品牌提及、可引用片段与合规表述。",
  };
}
