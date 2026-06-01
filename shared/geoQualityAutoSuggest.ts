import type { GeoQualityDimension, GeoQualityReviewResult } from "./geoQualityReview";
import type { GeoQualityDisplayArticle } from "./geoQualityScoreDisplay";
import { isGeoQualityScoreStale } from "./geoQualityStale";

/** 低于该分数时在内容卡片展示规则化优化建议 */
export const GEO_QUALITY_AUTO_SUGGEST_SCORE_THRESHOLD = 70;

/** 正文建议最低字数（含标题，按字符计） */
export const GEO_QUALITY_SUGGEST_MIN_CONTENT_CHARS = 2000;

const DIMENSION_LOW_RATIO = 0.6;

export const GEO_QUALITY_OPTIMIZATION_SUGGESTIONS = {
  missingCase: "建议添加1-2个具体客户案例",
  missingData: "建议添加具体数字或数据支撑",
  unclearTitle: "建议标题包含核心关键词",
  contentTooShort: "建议补充至2000字以上",
} as const;

const CASE_EVIDENCE_CASE_PATTERN = /案例|客户故事|客户案例|故事|见证/;
const CASE_EVIDENCE_DATA_PATTERN = /数据|数字|统计|指标|同比|环比|百分之|%|量化|证明不足|缺少.*数/;

const TITLE_ISSUE_PATTERN = /标题|关键词|keyword/i;

export type GeoQualitySuggestArticle = GeoQualityDisplayArticle & {
  title?: string | null;
  markdownContent?: string | null;
};

function parseGeoQualityDetail(detail: unknown): GeoQualityReviewResult | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as GeoQualityReviewResult;
  if (d.scores && typeof d.total === "number" && d.recommendation) return d;
  return null;
}

function isDimensionLow(dim: GeoQualityDimension | undefined): boolean {
  if (!dim || dim.max <= 0) return false;
  return dim.score / dim.max < DIMENSION_LOW_RATIO;
}

function inferCaseEvidenceSuggestions(dim: GeoQualityDimension): string[] {
  if (!isDimensionLow(dim)) return [];

  const reason = (dim.reason ?? "").trim();
  const ratio = dim.score / dim.max;
  const mentionsCase = CASE_EVIDENCE_CASE_PATTERN.test(reason);
  const mentionsData = CASE_EVIDENCE_DATA_PATTERN.test(reason);
  const out: string[] = [];

  if (mentionsCase && !mentionsData) {
    out.push(GEO_QUALITY_OPTIMIZATION_SUGGESTIONS.missingCase);
  } else if (mentionsData && !mentionsCase) {
    out.push(GEO_QUALITY_OPTIMIZATION_SUGGESTIONS.missingData);
  } else if (mentionsCase && mentionsData) {
    out.push(GEO_QUALITY_OPTIMIZATION_SUGGESTIONS.missingCase);
    out.push(GEO_QUALITY_OPTIMIZATION_SUGGESTIONS.missingData);
  } else if (ratio < 0.4) {
    out.push(GEO_QUALITY_OPTIMIZATION_SUGGESTIONS.missingCase);
    out.push(GEO_QUALITY_OPTIMIZATION_SUGGESTIONS.missingData);
  } else {
    out.push(GEO_QUALITY_OPTIMIZATION_SUGGESTIONS.missingCase);
  }

  return out;
}

function shouldSuggestUnclearTitle(dim: GeoQualityDimension | undefined): boolean {
  if (!isDimensionLow(dim)) return false;
  const reason = (dim?.reason ?? "").trim();
  return TITLE_ISSUE_PATTERN.test(reason) || (dim != null && dim.score / dim.max < 0.5);
}

function estimateContentCharCount(article: GeoQualitySuggestArticle): number {
  const title = (article.title ?? "").trim();
  const body = (article.markdownContent ?? "").trim();
  return `${title}\n${body}`.replace(/\s+/g, "").length;
}

/**
 * 质检分低于 70 时，根据 geoQualityDetail 各维度与正文字数生成固定优化建议（不调用 LLM）。
 */
export function resolveGeoQualityOptimizationSuggestions(article: GeoQualitySuggestArticle): string[] {
  const score = article.geoQualityScore;
  if (score == null || score >= GEO_QUALITY_AUTO_SUGGEST_SCORE_THRESHOLD) return [];
  if (isGeoQualityScoreStale(article)) return [];

  const detail = parseGeoQualityDetail(article.geoQualityDetail);
  const suggestions: string[] = [];
  const push = (text: string) => {
    if (!suggestions.includes(text)) suggestions.push(text);
  };

  if (detail?.scores) {
    for (const text of inferCaseEvidenceSuggestions(detail.scores.case_evidence)) {
      push(text);
    }

    if (shouldSuggestUnclearTitle(detail.scores.platform_friendly)) {
      push(GEO_QUALITY_OPTIMIZATION_SUGGESTIONS.unclearTitle);
    }
  }

  if (estimateContentCharCount(article) < GEO_QUALITY_SUGGEST_MIN_CONTENT_CHARS) {
    push(GEO_QUALITY_OPTIMIZATION_SUGGESTIONS.contentTooShort);
  }

  return suggestions;
}
