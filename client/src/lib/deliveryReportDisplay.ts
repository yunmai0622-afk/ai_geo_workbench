import type { AiTestEvidenceAggregate } from "@shared/aiTestEvidence";
import { formatDeliveryReportVisibilityScore, resolveDeliveryReportVisibilityScore } from "@shared/deliveryReportScore";

export {
  buildDeliveryReportConclusionLine,
  DELIVERY_REPORT_SCORE_MISSING_LABEL,
  formatDeliveryReportVisibilityScore,
  resolveDeliveryReportVisibilityScore,
  readGeoContentCoverageTotalScore,
} from "@shared/deliveryReportScore";

export type DeliveryReportPublishedItem = {
  title: string;
  platform: string;
  publishedAt: string | null;
  url: string | null;
};

export const DEFAULT_REPORT_SUGGESTIONS = [
  "补充 2-3 篇品牌认知类内容，明确「品牌名 + 品类 + 适用场景」实体信号。",
  "补充 1 篇竞品对比类内容，帮助 AI 建立差异化认知。",
  "在 7-14 天后对同一批问题安排发布后复测。",
] as const;

export function buildBusinessConclusion(params: {
  brandName: string;
  visibilityScore: number | null;
  mentionRate: number;
  recommendRate: number;
  hasAiTestData: boolean;
}): string {
  const { brandName, hasAiTestData, mentionRate, recommendRate } = params;
  if (!hasAiTestData) {
    return `${brandName} 尚未完成本轮 AI 搜索实测，建议先完成实测，以便形成可交付的经营结论。`;
  }
  const mentionPct = Math.round(mentionRate * 100);
  const recommendPct = Math.round(recommendRate * 100);

  if (mentionPct === 0) {
    return `当前 AI 搜索可见度较弱，${brandName} 尚未在主流 AI 回答中形成稳定推荐。建议继续补充品牌认知类和竞品对比类内容，并在 7-14 天后复测。`;
  }
  if (recommendPct === 0) {
    return `${brandName} 已在部分 AI 回答中被提及（提及率 ${mentionPct}%），但暂未形成稳定推荐。建议强化差异化叙事与可引用案例，并在 7-14 天后复测。`;
  }
  if (mentionPct < 30) {
    return `当前 AI 搜索可见度仍有提升空间（提及率 ${mentionPct}%）。建议持续补充场景化内容与品牌实体信号，并在 7-14 天后复测验证变化。`;
  }
  return `当前品牌在 AI 搜索中已有一定可见度（提及率 ${mentionPct}%，推荐率 ${recommendPct}%）。建议保持内容更新节奏，并在 7-14 天后安排发布后复测。`;
}

export function buildHeroSummaryLine(conclusionLine: string, visibilityScore: number | null): string {
  if (visibilityScore != null) {
    return `本轮 AI 搜索可见度综合评分为 ${visibilityScore} 分，可作为后续优化与复测的对照基线。`;
  }
  const trimmed = conclusionLine.trim();
  if (trimmed) {
    const first = trimmed.split(/[。；\n]/)[0]?.trim();
    if (first && first.length <= 120) return first.endsWith("。") ? first : `${first}。`;
  }
  return "请先完成 AI 搜索实测，以便生成面向客户的交付结论。";
}

export function buildEngineMentionSubtitle(
  byEngine: AiTestEvidenceAggregate["byEngine"],
  mentionRate: number,
  recommendRate: number,
): string {
  const engines = byEngine.filter(e => e.questionCount > 0);
  if (engines.length === 0) {
    return "完成 AI 搜索实测后，将展示各主流 AI 引擎中的品牌提及与推荐表现。";
  }
  const names = engines.map(e => e.engineName).join(" / ");
  return `品牌在 ${names} 中提及率 ${Math.round(mentionRate * 100)}%，推荐率 ${Math.round(recommendRate * 100)}%`;
}

export function buildAiTestExplanation(aggregate: AiTestEvidenceAggregate): string {
  if (aggregate.questionCount === 0) return "";
  const engines = aggregate.byEngine.filter(e => e.questionCount > 0);
  const engineLabel = engines.length > 0 ? engines.map(e => e.engineName).join("、") : "主流 AI 引擎";
  const mentionPct = Math.round(aggregate.mentionRate * 100);
  const tail =
    mentionPct === 0
      ? "说明 AI 在相关问题下暂未稳定识别该品牌。"
      : "说明 AI 在部分典型问题下已能识别该品牌，仍有进一步优化空间。";
  return `本轮共测试 ${aggregate.questionCount} 个真实问题，覆盖 ${engineLabel} 等 AI 引擎。当前品牌提及率为 ${mentionPct}%，${tail}`;
}

export function buildReportSummaryLines(params: {
  publishCount: number;
  questionCount: number;
  engineCount: number;
  mentionRate: number;
  recommendRate: number;
  hasAiTestData: boolean;
  visibilityScore?: number | null;
}): [string, string, string] {
  const { publishCount, questionCount, engineCount, mentionRate, recommendRate, hasAiTestData, visibilityScore = null } =
    params;
  const mentionPct = Math.round(mentionRate * 100);
  const recommendPct = Math.round(recommendRate * 100);
  let line1 = "暂无数据";
  if (publishCount > 0 && hasAiTestData) {
    line1 = `本轮完成了 ${publishCount} 篇内容发布，并对 ${questionCount} 个 AI 搜索问题进行了实测。`;
  } else if (publishCount > 0) {
    line1 = `本轮完成了 ${publishCount} 篇内容发布。`;
  } else if (hasAiTestData) {
    line1 = `本轮对 ${questionCount} 个 AI 搜索问题进行了实测（覆盖 ${engineCount} 个引擎）。`;
  }

  let line2 = "暂无数据";
  if (visibilityScore != null) {
    const scoreLead = `本轮 AI 搜索可见度综合评分为 ${visibilityScore} 分`;
    if (!hasAiTestData) {
      line2 = `${scoreLead}，可作为后续优化与复测的对照基线。`;
    } else if (mentionPct === 0) {
      line2 = `${scoreLead}；当前品牌在主流 AI 回答中的提及率为 0%，说明品牌实体信号仍需增强。`;
    } else {
      line2 = `${scoreLead}；当前品牌在主流 AI 回答中的提及率为 ${mentionPct}%${recommendPct > 0 ? `、推荐率为 ${recommendPct}%` : ""}。`;
    }
  } else if (!hasAiTestData) {
    line2 = "当前暂无完整实测数据，无法判断品牌在 AI 搜索中的表现。";
  } else if (mentionPct === 0) {
    line2 = "当前品牌在主流 AI 回答中的提及率为 0%，说明品牌实体信号仍需增强。";
  } else {
    line2 = `当前品牌在主流 AI 回答中的提及率为 ${mentionPct}%${recommendPct > 0 ? `、推荐率为 ${recommendPct}%` : ""}，整体可见度有待持续提升。`;
  }

  let line3 = "暂无数据";
  if (!hasAiTestData) {
    line3 = "下一步建议先完成 AI 搜索实测，再制定优化动作。";
  } else if (mentionPct === 0) {
    line3 = "下一步建议补充品牌认知类和竞品对比类内容，并在 7-14 天后进行发布后复测。";
  } else {
    line3 = "下一步建议持续优化内容资产，并在 7-14 天后安排发布后复测。";
  }

  return [line1, line2, line3];
}

export function buildNextActionLines(
  mentionRate: number,
  recommendRate: number,
  publishCount: number,
  hasAiTestData: boolean,
  customLines?: string[],
): string[] {
  if (customLines?.length) {
    return customLines.slice(0, 3);
  }
  const mentionPct = Math.round(mentionRate * 100);

  if (!hasAiTestData) {
    return [
      "先完成一轮 AI 搜索实测，建立可对照的可见度基线。",
      "完成内容发布并登记公开链接，沉淀 AI 搜索资产。",
      "在 7-14 天后安排复测并更新交付报告。",
    ];
  }
  if (mentionPct === 0) {
    return [
      "补充 2-3 篇品牌认知类内容，强化「品牌名 + 品类 + 适用场景」。",
      "补充 1 篇竞品对比类内容，帮助 AI 建立差异化认知。",
      "在 7-14 天后对同一批问题安排发布后复测。",
    ];
  }
  if (Math.round(recommendRate * 100) === 0) {
    return [
      "强化可引用案例与差异化卖点，提升 AI 推荐倾向。",
      "围绕高意图场景词补充 1-2 篇结构化内容。",
      "在 7-14 天后复测并对比本轮基线。",
    ];
  }
  if (publishCount === 0) {
    return [
      "完成内容发布并登记公开链接，形成可追踪的 AI 搜索资产。",
      "对已选典型问题安排一次 AI 搜索实测。",
      "在 7-14 天后复测并记录变化。",
    ];
  }
  return [
    "围绕高价值场景词更新 1-2 篇可引用内容。",
    "内容稳定收录后安排发布后复测。",
    "在 7-14 天后查看提及率与推荐率变化。",
  ];
}

export function showPublishCompareSection(compare: AiTestEvidenceAggregate["publishCompare"]): boolean {
  return compare.before.hasData || compare.after.hasData;
}

export function formatPublishedAtLabel(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function mapPublishRecordsToItems(
  records: Array<Record<string, unknown>>,
  titleByArticleId: Map<number, string>,
): DeliveryReportPublishedItem[] {
  return records.map(r => {
    const articleId = typeof r.articleId === "number" ? r.articleId : null;
    const title =
      (articleId != null ? titleByArticleId.get(articleId) : undefined) ??
      (typeof r.publishTitle === "string" ? r.publishTitle : undefined) ??
      (typeof r.title === "string" ? r.title : undefined) ??
      "未命名内容";
    const platform = String(r.publishChannel ?? r.platform ?? "—");
    const url =
      (typeof r.publishUrl === "string" && r.publishUrl) ||
      (typeof r.publicUrl === "string" && r.publicUrl) ||
      null;
    const publishedAt = formatPublishedAtLabel(
      (r.publishedAt ?? r.published_at) as Date | string | null | undefined,
    );
    return { title, platform, publishedAt, url };
  });
}
