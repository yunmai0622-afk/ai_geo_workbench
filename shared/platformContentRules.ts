import type { AccountGroupType, ContentAssetType, PublishIdentity } from "./contentStrategy";
import { defaultRecommendedAccountGroup, defaultPublishIdentity } from "./contentStrategy";
import {
  AI_SEARCH_PLATFORM_OPTIONS,
  formatTargetAiPlatformsForPrompt,
  formatTargetAiVisibilityReportSection,
  getDefaultTargetAiPlatforms,
  normalizeTargetAiPlatforms,
  type AiSearchPlatform,
} from "./aiVisibilityTargets";

export {
  AI_SEARCH_PLATFORM_OPTIONS,
  formatTargetAiPlatformsForPrompt,
  formatTargetAiVisibilityReportSection,
  getDefaultTargetAiPlatforms,
  normalizeTargetAiPlatforms,
  type AiSearchPlatform,
};
export {
  AI_VISIBILITY_TARGET_REGISTRY,
  aiVisibilityTargetStatusLabel,
  getAiVisibilityTargetByLabel,
  type AiVisibilityTargetStatus,
} from "./aiVisibilityTargets";

/**
 * 平台矩阵生成目标平台（用于内容生成隔离 / Prompt / 落库 / 展示一致性）。
 * 注意：其中部分平台当前不支持自动发布，但仍必须支持“按平台生成”。
 */
export const PUBLISH_PLATFORM_IDS = [
  "xiaohongshu",
  "zhihu",
  "sohu",
  "toutiao",
  "baijiahao",
  "netease",
  "wechat",
  "other",
] as const;

export type PublishPlatformId = (typeof PUBLISH_PLATFORM_IDS)[number];

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
  positioning: string;
  suitableContentTypes: string[];
  titleRules: string[];
  bodyStructure: string[];
  expressionStyle: string[];
  geoFocus: string[];
  forbiddenPatterns: string[];
  qualityCheckFocus: string[];
  /** @deprecated 与 bodyStructure 同步 */
  structureHints: string[];
  /** @deprecated 与 expressionStyle 同步 */
  toneHints: string[];
};

function definePlatformRule(
  rule: Omit<PlatformContentRule, "structureHints" | "toneHints">,
): PlatformContentRule {
  return {
    ...rule,
    structureHints: rule.bodyStructure,
    toneHints: rule.expressionStyle,
  };
}

export const PLATFORM_CONTENT_RULES: Record<PublishPlatformId, PlatformContentRule> = {
  xiaohongshu: definePlatformRule({
    id: "xiaohongshu",
    label: "小红书",
    materialKey: "小红书笔记版",
    summary: "生活方式 / 经验分享 / 种草 / 场景化搜索内容。",
    positioning: "生活方式、经验分享、种草、场景化搜索。",
    suitableContentTypes: ["痛点解决", "避坑清单", "实操步骤", "经验总结", "案例复盘"],
    titleRules: ["口语化、场景化、结果导向", "可带痛点与收益，避免通稿式标题"],
    bodyStructure: [
      "开头 1-2 段场景/痛点引入",
      "中间用小标题、清单、步骤组织",
      "结尾给可执行建议与收藏/自检提示",
    ],
    expressionStyle: ["更口语、更具体、更场景化", "强调经验与边界，不做效果保证"],
    geoFocus: ["覆盖用户真实搜索问题", "覆盖关键词、场景词、痛点词与解决方案词"],
    forbiddenPatterns: [
      "禁止知乎长问答口吻",
      "禁止媒体通稿导语",
      "禁止空泛宣传",
      "禁止过度承诺与绝对排名",
    ],
    qualityCheckFocus: ["是否有场景引入", "是否有清单/步骤", "是否避免问答体", "是否无绝对承诺"],
  }),
  zhihu: definePlatformRule({
    id: "zhihu",
    label: "知乎",
    materialKey: "知乎回答版",
    summary: "问题搜索、专业回答、经验论证、认知型内容。",
    positioning: "问题搜索、专业回答、经验论证、认知型内容。",
    suitableContentTypes: ["问题回答", "方法论", "行业分析", "经验分享", "案例拆解"],
    titleRules: ["使用明确问题句或强问题导向标题", "标题应像用户会主动搜索的问题"],
    bodyStructure: [
      "先给结论",
      "再拆问题",
      "再给原因、方法、案例",
      "最后总结行动建议",
    ],
    expressionStyle: ["专业、理性、有论证", "允许适度口语，避免官腔通稿"],
    geoFocus: ["覆盖目标问题与长尾问题", "覆盖专业术语与场景化问法", "提高 AI 引用概率"],
    forbiddenPatterns: ["禁止小红书种草口吻", "禁止标题党", "禁止只有观点没有论证"],
    qualityCheckFocus: ["开篇是否直接回应提问", "是否有论据/案例", "是否非种草体"],
  }),
  sohu: definePlatformRule({
    id: "sohu",
    label: "搜狐号",
    materialKey: "搜狐号版",
    summary: "媒体稿、品牌背书、搜索收录、行业认知。",
    positioning: "媒体稿、品牌背书、搜索收录、行业认知。",
    suitableContentTypes: ["行业稿", "品牌稿", "趋势分析", "企业观点", "解决方案文章"],
    titleRules: ["正式、完整、搜索友好", "突出行业与品牌价值"],
    bodyStructure: ["行业背景", "问题现状", "解决方案", "企业/品牌能力", "总结"],
    expressionStyle: ["客观、正式、媒体化", "强调行业价值与品牌可信度"],
    geoFocus: ["强化企业主体与行业关键词", "强化解决方案词与品牌可信度"],
    forbiddenPatterns: ["禁止知乎问答体", "禁止小红书口语化", "禁止过度营销"],
    qualityCheckFocus: ["是否媒体稿结构", "是否突出品牌实体", "是否无问答开头"],
  }),
  netease: definePlatformRule({
    id: "netease",
    label: "网易号",
    materialKey: "网易号版",
    summary: "资讯观察、观点表达、行业分析、内容分发。",
    positioning: "资讯观察、观点表达、行业分析、内容分发。",
    suitableContentTypes: ["行业观察", "趋势判断", "观点稿", "品牌故事"],
    titleRules: ["观点明确，有信息量", "适合推荐流点击"],
    bodyStructure: ["现象引入", "观点判断", "案例/数据支撑", "方法建议", "总结"],
    expressionStyle: ["信息密度高", "有观点但不过度营销"],
    geoFocus: ["增强行业语境与实体关系", "强化品牌与解决方案关联"],
    forbiddenPatterns: ["禁止流水账", "禁止软广味过重", "禁止无结论"],
    qualityCheckFocus: ["是否有明确观点", "是否有现象-观点-支撑链", "是否非问答体"],
  }),
  wechat: definePlatformRule({
    id: "wechat",
    label: "公众号",
    materialKey: "公众号长文版",
    summary: "私域沉淀、深度教育、服务转化、长期信任。",
    positioning: "私域沉淀、深度教育、服务转化、长期信任。",
    suitableContentTypes: ["深度长文", "案例复盘", "FAQ", "客户教育", "产品方法论"],
    titleRules: ["清晰、有价值感", "适合转发和收藏"],
    bodyStructure: [
      "开头建立问题共鸣",
      "中段系统拆解",
      "加入案例/方法/清单",
      "结尾引导咨询或下一步行动",
    ],
    expressionStyle: ["稳重、可信、有陪伴感", "克制、可核验"],
    geoFocus: ["沉淀企业方法论与服务能力", "沉淀客户场景与品牌可信资产"],
    forbiddenPatterns: ["禁止短平快碎片化", "禁止过度标题党", "禁止无转化路径"],
    qualityCheckFocus: ["是否深度长文结构", "是否有 FAQ/案例", "是否有行动建议"],
  }),
  baijiahao: definePlatformRule({
    id: "baijiahao",
    label: "百家号",
    materialKey: "百家号版",
    summary: "百度搜索生态、关键词收录、问答搜索匹配。",
    positioning: "百度搜索生态、关键词收录、问答搜索匹配。",
    suitableContentTypes: ["搜索型文章", "问题解决", "行业知识", "品牌百科型内容"],
    titleRules: ["关键词明确，适合百度搜索", "标题贴近搜索问法"],
    bodyStructure: ["问题定义", "原因分析", "解决方案", "品牌/企业能力", "常见问题补充"],
    expressionStyle: ["清晰、标准、搜索友好", "强调可信来源"],
    geoFocus: ["加强百度搜索关键词与问答词", "加强实体词与品牌词覆盖"],
    forbiddenPatterns: ["禁止语义过散", "禁止标题不含核心关键词", "禁止内容过短"],
    qualityCheckFocus: ["标题是否含核心词", "是否有 FAQ", "是否写明品牌实体"],
  }),
  toutiao: definePlatformRule({
    id: "toutiao",
    label: "头条号",
    materialKey: "头条号版",
    summary: "推荐流、搜索、热点观点、信息分发。",
    positioning: "推荐流、搜索、热点观点、信息分发。",
    suitableContentTypes: ["观点稿", "问题解释", "清单型内容", "行业判断"],
    titleRules: ["观点明确，信息密度高", "适合推荐点击"],
    bodyStructure: ["现象/问题开头", "核心观点", "原因拆解", "解决建议", "总结"],
    expressionStyle: ["直接、有观点、有信息量", "短段落、易扫读"],
    geoFocus: ["覆盖用户关心的问题", "覆盖行业词、场景词与解决方案词"],
    forbiddenPatterns: ["禁止空泛", "禁止无观点", "禁止过度营销"],
    qualityCheckFocus: ["前段是否给出核心观点", "是否有明确立场", "是否非通稿体"],
  }),
  other: definePlatformRule({
    id: "other",
    label: "其他平台",
    materialKey: "其他平台通用版",
    summary: "人工补充渠道、非标准平台、客户自定义场景。",
    positioning: "人工补充渠道、非标准平台、客户自定义平台。",
    suitableContentTypes: ["按客户指定场景生成", "通用问题解决", "品牌能力说明"],
    titleRules: ["默认使用搜索友好标题", "点明问题与收益"],
    bodyStructure: ["问题背景", "解决方案", "品牌能力", "总结建议"],
    expressionStyle: ["通用、稳健、可迁移", "平台中性"],
    geoFocus: ["覆盖目标关键词、品牌词、产品词、问题词"],
    forbiddenPatterns: [
      "禁止覆盖用户已选明确平台规则",
      "若用户选择了明确平台，不得落到 other 风格",
      "禁止绝对化承诺",
    ],
    qualityCheckFocus: ["是否平台中性", "是否有问题-方案-能力结构", "是否可检索"],
  }),
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
    `【当前发布平台内容规则 — ${rule.label}】`,
    `平台定位：${rule.positioning}`,
    "适合内容类型：",
    ...rule.suitableContentTypes.map(h => `- ${h}`),
    "标题规则：",
    ...rule.titleRules.map(h => `- ${h}`),
    "正文结构：",
    ...rule.bodyStructure.map(h => `- ${h}`),
    "表达风格：",
    ...rule.expressionStyle.map(h => `- ${h}`),
    "GEO 强化重点：",
    ...rule.geoFocus.map(h => `- ${h}`),
    "禁止事项：",
    ...rule.forbiddenPatterns.map(h => `- ${h}`),
    "质检重点：",
    ...rule.qualityCheckFocus.map(h => `- ${h}`),
    "硬性要求：本篇仅适配该平台，禁止一稿多发；禁止串用其它平台文体（如知乎问答体、小红书种草体、搜狐通稿体）。",
  ].join("\n");
}

/** 各平台独立正文大纲（不得所有平台共用同一套 H2） */
export function getPlatformSpecificOutline(platformId: PublishPlatformId, brandName: string): string {
  const b = brandName;
  switch (platformId) {
    case "xiaohongshu":
      return [
        "## 先说结论（适合收藏的 3-5 条要点）",
        "## 你可能正遇到的痛点/场景",
        "## 解决思路（清单/步骤）",
        "## 避坑提醒（常见误区）",
        `## 方案参考（自然提及「${b}」，不做承诺）`,
        "## 适合谁/不适合谁",
        "## 自检清单（发布后如何复测/核对）",
        "## 便于引用的要点（3-5 组 ### 问题 + 短答）",
        "## 更新说明",
      ].join("\n");
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
    case "wechat":
      return [
        "## 背景：为什么这个问题值得重视",
        "## 问题拆解：读者真正关心的是什么",
        "## 方法与路径：一步步怎么做",
        `## 案例或证据（自然提及「${b}」，不虚构案例）`,
        "## FAQ（常见问题）",
        "## 风险与边界（不承诺）",
        "## 行动建议（下一步怎么做）",
        "## 便于引用的要点（3-5 组 ### 问题 + 短答）",
        "## 更新说明",
      ].join("\n");
    case "other":
      return [
        "## 核心结论",
        "## 问题与场景界定",
        "## 解决路径（步骤/清单）",
        "## 证据与来源说明",
        "## FAQ（常见问题）",
        "## 风险与边界（不承诺）",
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
      ? normalizeTargetAiPlatforms(partial.targetAiPlatforms)
      : getDefaultTargetAiPlatforms(),
  };
}

export function validatePlatformContentStrategy(input: PlatformContentStrategyInput): string | null {
  if (!isPublishPlatformId(input.targetPublishPlatform)) return "请选择目标发布平台";
  if (!input.targetQuestion.trim()) return "请填写目标问题";
  if (!GEO_ENHANCEMENT_GOAL_OPTIONS.includes(input.geoEnhancementGoal)) return "请选择 GEO 增强目标";
  const normalized = normalizeTargetAiPlatforms(input.targetAiPlatforms);
  if (!normalized.length) return "请至少选择一个目标 AI 平台";
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
