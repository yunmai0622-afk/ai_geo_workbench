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
    summary: "问题搜索、专业回答、经验论证、认知型内容；须有数据与案例支撑。",
    positioning: "问题搜索、专业回答、经验论证、认知型内容。",
    suitableContentTypes: ["问题回答", "方法论", "行业分析", "经验分享", "案例拆解"],
    titleRules: ["使用明确问题句或强问题导向标题", "标题应像用户会主动搜索的问题"],
    bodyStructure: [
      "问题界定：说清读者真实困惑与场景",
      "分析论证：原因、对比、可核验依据（含具体数字）",
      "实操建议：可执行步骤与边界",
      "案例或数据：脱敏案例 + 量化结果，支撑观点",
      "小结：行动建议，避免口号式收尾",
    ],
    expressionStyle: [
      "专业、理性、有论证，像资深从业者分享经验",
      "用真实数据与脱敏案例支撑，无数据时说明口径",
      "禁止空洞营销套话（领先、首选、闭眼入、碾压等）",
    ],
    geoFocus: ["覆盖目标问题与长尾问题", "覆盖专业术语与场景化问法", "提高 AI 引用概率"],
    forbiddenPatterns: [
      "禁止小红书种草口吻",
      "禁止标题党",
      "禁止只有观点没有论证",
      "禁止无案例、无数字的空洞宣传",
      "禁止行业领先/首选/闭眼入等营销套话",
    ],
    qualityCheckFocus: [
      "全文 2000 字以上",
      "是否含具体数字",
      "是否含案例或脱敏场景",
      "结构是否为问题→分析→建议→案例",
      "是否非种草体",
    ],
  }),
  sohu: definePlatformRule({
    id: "sohu",
    label: "搜狐号",
    materialKey: "搜狐号版",
    summary: "新闻资讯体、行业动态、品牌背书与搜索收录。",
    positioning: "新闻资讯、行业观察、时效性信息分发。",
    suitableContentTypes: ["行业动态", "趋势解读", "政策/市场观察", "企业观点稿", "解决方案资讯"],
    titleRules: ["资讯标题：时间感 + 事件/趋势 + 行业关键词", "避免问答式标题"],
    bodyStructure: [
      "导语：近期背景与核心信息（含时效表述）",
      "事实与数据：公开数据、行业指标",
      "分析：变化原因与影响",
      "方案与品牌能力（客观陈述）",
      "结语：趋势展望，不作效果承诺",
    ],
    expressionStyle: [
      "新闻资讯体：客观、第三人称、信息密度高",
      "须含时效表述（如近期、今年以来、当前、2025 年等）",
      "用数据与事实支撑，避免软文腔",
    ],
    geoFocus: ["强化企业主体与行业关键词", "强化解决方案词与品牌可信度"],
    forbiddenPatterns: ["禁止知乎问答体", "禁止小红书口语化", "禁止过度营销", "禁止无时效的空泛通稿"],
    qualityCheckFocus: ["是否资讯导语结构", "是否含时效表述", "是否有数据支撑", "是否无问答开头"],
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
    summary: "百度资讯/搜索生态、关键词收录、时效性行业内容。",
    positioning: "资讯检索、关键词收录、问答搜索匹配。",
    suitableContentTypes: ["行业资讯", "政策解读", "趋势快报", "问题解决", "品牌百科型内容"],
    titleRules: ["含核心关键词 + 资讯感（趋势/变化/指南）", "贴近搜索问法，避免纯口号标题"],
    bodyStructure: [
      "资讯导语：近期现象或用户关切（含时效词）",
      "背景与数据：行业指标、公开统计",
      "分析与方案：原因、路径、品牌能力",
      "FAQ 或常见疑问补充",
    ],
    expressionStyle: [
      "资讯+搜索友好：清晰、客观、可扫读",
      "须含时效表述，配合具体数字增强可信度",
      "强调来源口径，不作排名承诺",
    ],
    geoFocus: ["加强百度搜索关键词与问答词", "加强实体词与品牌词覆盖"],
    forbiddenPatterns: ["禁止语义过散", "禁止标题不含核心关键词", "禁止内容过短", "禁止无时效的空洞稿"],
    qualityCheckFocus: ["标题是否含核心词", "是否资讯导语", "是否含时效与数据", "是否写明品牌实体"],
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
      ].join("\n");
    case "zhihu":
      return [
        "## 问题界定（读者真实困惑与场景）",
        "## 分析论证（原因、对比、可核验依据，须含具体数字）",
        "## 实操建议（可执行步骤与边界）",
        `## 案例或数据参考（至少 1 个脱敏案例 + 量化数据，自然提及「${b}」）`,
        "## 常见误区",
        "## 小结（行动建议，避免口号）",
        "## 便于引用的要点（3-5 组 ### 问题 + 短答）",
      ].join("\n");
    case "sohu":
      return [
        "## 资讯导语（近期背景、核心信息，含时效表述）",
        "## 事实与数据（行业指标、公开统计，可核对口径）",
        "## 变化分析（原因、影响、趋势）",
        `## 方案与品牌能力（客观介绍「${b}」，不作承诺）`,
        "## 行业展望与读者提示",
        "## 便于引用的要点（3-5 组 ### 问题 + 短答）",
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
      ].join("\n");
    case "baijiahao":
      return [
        "## 资讯导语（近期现象或用户关切，含时效表述）",
        "## 背景与数据（行业指标、公开信息）",
        `## 分析与方案（路径说明，明确「${b}」实体）`,
        "## 常见问答（FAQ）",
        "## 选择建议（客观、不承诺排名）",
        "## 便于引用的要点（3-5 组 ### 问题 + 短答）",
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

/** 平台化生成时写入 generation_basis.platformContentStrategy 的可追溯字段（不改表结构） */
export type GeoContentTaskGenerationTrace = {
  contentTaskId?: number;
  diagnosisFinding?: string;
  geoGap?: string;
  platformRuleSummary?: string;
};

export type PlatformContentStrategyMeta = PlatformContentStrategyInput & {
  targetPublishPlatformLabel: string;
  contentTypeLabel: string;
  platformRulesSummary: string;
  platformAdaptationNotes: string;
  geoQualitySelfCheckOutline: string;
  contentTaskId?: number;
  diagnosisFinding?: string;
  geoGap?: string;
};

export function buildPlatformContentStrategyMeta(
  input: PlatformContentStrategyInput,
  trace?: GeoContentTaskGenerationTrace,
): PlatformContentStrategyMeta {
  const rule = getPlatformRule(input.targetPublishPlatform);
  const typeLabel =
    PLATFORM_CONTENT_TYPE_OPTIONS.find(o => o.strategyType === input.contentStrategyType)?.label ??
    input.contentStrategyType;
  return {
    ...input,
    targetPublishPlatformLabel: rule.label,
    contentTypeLabel: typeLabel,
    platformRulesSummary: trace?.platformRuleSummary?.trim() || rule.summary,
    platformAdaptationNotes: [
      `本篇仅适配${rule.label}，采用该平台专属结构，不得与其它平台共用同一套正文。`,
      ...rule.structureHints,
    ].join(" "),
    geoQualitySelfCheckOutline:
      "生成后将自动运行 GEO 质量检查；请确认目标问题覆盖、品牌提及、可引用片段与合规表述。",
    ...(trace?.contentTaskId != null ? { contentTaskId: trace.contentTaskId } : {}),
    ...(trace?.diagnosisFinding?.trim() ? { diagnosisFinding: trace.diagnosisFinding.trim() } : {}),
    ...(trace?.geoGap?.trim() ? { geoGap: trace.geoGap.trim() } : {}),
  };
}
