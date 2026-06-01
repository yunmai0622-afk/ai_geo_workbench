import type { PublishPlatformId } from "./platformContentRules";

/** 知乎正文建议最低字数（Markdown 正文，去空白计） */
export const ZHIHU_DRAFT_MIN_BODY_CHARS = 2000;

const CONCRETE_NUMBER_PATTERN =
  /(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:%|％|倍|万|亿|家|个|人|天|周|个月|年|次|元|美元|人民币|RM|条|项|场|页|篇)|\d{4}\s*年|同比|环比|增长\s*\d|下降\s*\d|约\s*\d|超过\s*\d|不足\s*\d|达到\s*\d/i;

const CASE_EVIDENCE_PATTERN =
  /案例|客户故事|真实场景|脱敏|某(?:教育|培训|机构|企业|品牌|讲师|团队|客户)|一线.{0,12}(?:反馈|实践|经验)|例如.{0,40}(?:后|时|中)|实践表明|亲历者|使用者分享/i;

const MARKETING_HYPE_PATTERN =
  /行业领先|颠覆性|史无前例|首选|不二之选|闭眼入|必买|最强|无敌|碾压|吊打/i;

const TIMELINESS_PATTERN =
  /近期|近日|本月|本周|上周|今年以来|过去一年|当前|眼下|202[4-9]\s*年|今年|一季度|二季度|三季度|四季度|上半年|下半年/i;

export type PlatformDraftQualityIssue =
  | "body_too_short"
  | "missing_concrete_number"
  | "missing_case_evidence"
  | "marketing_hype"
  | "missing_timeliness";

export type PlatformDraftContentQualityResult = {
  platformId: PublishPlatformId;
  passed: boolean;
  issues: PlatformDraftQualityIssue[];
  bodyCharCount: number;
  messages: string[];
};

export function countMarkdownBodyChars(markdown: string): number {
  return markdown.replace(/\s+/g, "").length;
}

export function hasConcreteNumericData(text: string): boolean {
  return CONCRETE_NUMBER_PATTERN.test(text);
}

export function hasCaseEvidenceInText(text: string): boolean {
  return CASE_EVIDENCE_PATTERN.test(text);
}

export function hasTimelinessExpression(text: string): boolean {
  return TIMELINESS_PATTERN.test(text);
}

export function hasMarketingHypeLanguage(text: string): boolean {
  return MARKETING_HYPE_PATTERN.test(text);
}

const PLATFORMS_WITH_DRAFT_QUALITY_GATE: PublishPlatformId[] = ["zhihu", "sohu", "baijiahao"];

export function shouldRunPlatformDraftQualityGate(platformId: PublishPlatformId | null | undefined): boolean {
  return Boolean(platformId && PLATFORMS_WITH_DRAFT_QUALITY_GATE.includes(platformId));
}

export function evaluatePlatformDraftContentQuality(
  platformId: PublishPlatformId,
  markdownContent: string,
): PlatformDraftContentQualityResult {
  const bodyCharCount = countMarkdownBodyChars(markdownContent);
  const issues: PlatformDraftQualityIssue[] = [];
  const messages: string[] = [];

  if (platformId === "zhihu") {
    if (bodyCharCount < ZHIHU_DRAFT_MIN_BODY_CHARS) {
      issues.push("body_too_short");
      messages.push(`正文不少于 ${ZHIHU_DRAFT_MIN_BODY_CHARS} 字（当前约 ${bodyCharCount} 字）`);
    }
    if (!hasConcreteNumericData(markdownContent)) {
      issues.push("missing_concrete_number");
      messages.push("须包含可核验的具体数字（如比例、规模、周期、样本量等，可脱敏）");
    }
    if (!hasCaseEvidenceInText(markdownContent)) {
      issues.push("missing_case_evidence");
      messages.push("须包含至少 1 处案例或脱敏场景（如某机构/某讲师/真实场景）");
    }
    if (hasMarketingHypeLanguage(markdownContent)) {
      issues.push("marketing_hype");
      messages.push("避免空洞营销套话（如行业领先、首选、闭眼入等）");
    }
  }

  if (platformId === "sohu" || platformId === "baijiahao") {
    if (!hasTimelinessExpression(markdownContent)) {
      issues.push("missing_timeliness");
      messages.push("资讯体须含时效表述（如近期、今年以来、2025 年、当前等）");
    }
    if (!hasConcreteNumericData(markdownContent)) {
      issues.push("missing_concrete_number");
      messages.push("资讯稿建议用具体数字支撑观点（规模、增速、占比等，可来自公开资料）");
    }
  }

  return {
    platformId,
    passed: issues.length === 0,
    issues,
    bodyCharCount,
    messages,
  };
}

/** 生成阶段质量不合格时追加到 user prompt 的改写指令 */
/** 写入生成 user prompt 的平台硬性要求（与 PLATFORM_CONTENT_RULES 配套） */
export function buildPlatformGenerationQualityPromptLines(platformId: PublishPlatformId): string[] {
  switch (platformId) {
    case "zhihu":
      return [
        "【知乎专项硬性要求】",
        "- 全文 Markdown 正文不少于 2000 字（去空白计）",
        "- 结构：问题界定 → 分析论证 → 实操建议 → 案例或数据参考 → 常见误区 → 小结",
        "- 至少 2 处可核验的具体数字（比例、规模、周期、样本量等，可脱敏）",
        "- 至少 1 个脱敏案例或真实场景描述，禁止虚构客户名与结果",
        "- 禁止空洞营销语言（行业领先、首选、闭眼入、碾压竞品等）",
      ];
    case "sohu":
      return [
        "【搜狐号专项硬性要求】",
        "- 新闻资讯体：第三人称、客观陈述，不用知乎问答开头",
        "- 导语与正文须含时效表述（如近期、今年以来、当前、2025 年等）",
        "- 用公开可查的数据或行业指标支撑观点",
      ];
    case "baijiahao":
      return [
        "【百家号专项硬性要求】",
        "- 资讯+搜索友好体，标题与首段含核心关键词",
        "- 须含时效表述，配合具体数字增强可信度",
        "- 客观陈述，不作排名或效果承诺",
      ];
    default:
      return [];
  }
}

export function buildPlatformDraftQualityRewriteAddon(
  check: PlatformDraftContentQualityResult,
  brandName: string,
): string {
  const lines = [
    "【质量校验未通过 — 请全文重写】",
    "上一轮稿未通过自动质检，请在同一平台规则下重新撰写完整 Markdown 正文：",
    ...check.messages.map(m => `- ${m}`),
  ];
  if (check.platformId === "zhihu") {
    lines.push(
      "- 结构严格按：问题界定 → 分析论证 → 实操建议 → 案例或数据参考 → 常见误区 → 小结",
      "- 全文 2000 字以上，用具体数字与至少 1 个脱敏案例支撑，禁止空洞营销话术",
      `- 在「案例或数据参考」小节自然提及「${brandName}」一次即可，勿堆砌硬广`,
    );
  }
  if (check.platformId === "sohu" || check.platformId === "baijiahao") {
    lines.push(
      "- 采用新闻资讯体：导语点明近期背景，正文含时效表述与可核对的数据点",
      "- 客观陈述行业变化，避免问答体与种草口吻",
    );
  }
  return lines.join("\n");
}
