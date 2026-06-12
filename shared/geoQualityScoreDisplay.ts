import { GEO_ARTICLE_MIN_PASS_SCORE } from "./const";
import { getContentQualityGateStatus, type ContentQualityGateArticle, coerceTrimmedOptionalString } from "./contentQualityGate";
import type { GeoQualityRecommendation } from "./geoQualityReview";
import {
  GEO_QUALITY_DIMENSION_META,
  GEO_QUALITY_DIMENSION_ORDER,
  type GeoQualityDimensionKey,
  type GeoQualityReviewResult,
} from "./geoQualityReview";
import { isGeoQualityScoreStale } from "./geoQualityStale";
import { looksLikeInternalTechnicalError, toUserFacingError } from "./userFacingErrors";

export type GeoQualityScoreTierId = "excellent" | "good" | "fair" | "needs_work";

export type GeoQualityScoreTier = {
  id: GeoQualityScoreTierId;
  label: string;
  badgeClassName: string;
};

const TIER_EXCELLENT: GeoQualityScoreTier = {
  id: "excellent",
  label: "优秀",
  badgeClassName: "bg-emerald-100 text-emerald-800",
};

const TIER_GOOD: GeoQualityScoreTier = {
  id: "good",
  label: "良好",
  badgeClassName: "bg-blue-100 text-blue-800",
};

const TIER_FAIR: GeoQualityScoreTier = {
  id: "fair",
  label: "一般",
  badgeClassName: "bg-amber-100 text-amber-800",
};

const TIER_NEEDS_WORK: GeoQualityScoreTier = {
  id: "needs_work",
  label: "需优化",
  badgeClassName: "bg-red-100 text-red-800",
};

/** 内容质检分数等级（展示用） */
export function getGeoQualityScoreTier(score: number): GeoQualityScoreTier {
  if (score >= 90) return TIER_EXCELLENT;
  if (score >= 70) return TIER_GOOD;
  if (score >= 60) return TIER_FAIR;
  return TIER_NEEDS_WORK;
}

export type GeoQualityCardView = {
  score: number;
  tier: GeoQualityScoreTier;
  staleLabel: string | null;
};

export type GeoQualityDisplayArticle = ContentQualityGateArticle & {
  geoQualityScore?: number | null;
  geoQualityRecommendation?: string | null;
  geoQualityDetail?: unknown;
  geoQualityStale?: boolean | number | null;
};

export type GeoLegacyQualityScoreRow = {
  articleId?: number;
  totalScore?: number | null;
  blocked?: number | boolean | null;
  blockReasons?: string[] | null;
  isPass?: boolean | null;
};

function hasComplianceBlockReasons(reasons: string[]): boolean {
  return reasons.some(reason => /禁用词|禁止承诺|合规/.test(reason));
}

function inferRecommendationFromLegacyRow(
  row: GeoLegacyQualityScoreRow | null | undefined,
  score: number | null,
): GeoQualityRecommendation | null {
  if (!row || score == null) return null;
  const reasons = Array.isArray(row.blockReasons) ? row.blockReasons : [];
  if (row.blocked || hasComplianceBlockReasons(reasons) || score < GEO_ARTICLE_MIN_PASS_SCORE) {
    return "reject";
  }
  if (score >= 80) return "publish";
  return "revise";
}

export function dedupeLatestQualityScoreRows<T extends { articleId?: number }>(rows: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const row of rows) {
    const id = row.articleId;
    if (id == null) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

/** 列表 / 卡片 / 入队门禁共用的质检总分 */
export function resolveEffectiveGeoQualityScore(
  article: GeoQualityDisplayArticle,
  legacyRow?: GeoLegacyQualityScoreRow | null,
): number | null {
  if (!isGeoQualityScoreStale(article) && article.geoQualityScore != null) {
    return article.geoQualityScore;
  }
  if (legacyRow?.totalScore != null) return legacyRow.totalScore;
  return article.geoQualityScore ?? null;
}

export function resolveEffectiveGeoQualityRecommendation(
  article: GeoQualityDisplayArticle,
  legacyRow?: GeoLegacyQualityScoreRow | null,
  score?: number | null,
): GeoQualityRecommendation | null {
  const effectiveScore = score ?? resolveEffectiveGeoQualityScore(article, legacyRow);
  const fromArticle = coerceTrimmedOptionalString(article.geoQualityRecommendation);
  if (!isGeoQualityScoreStale(article) && fromArticle) {
    return fromArticle as GeoQualityRecommendation;
  }
  return inferRecommendationFromLegacyRow(legacyRow, effectiveScore);
}

export function resolveQualityBlockingIssues(
  article: GeoQualityDisplayArticle,
  legacyRow?: GeoLegacyQualityScoreRow | null,
): string[] {
  const unified = buildUnifiedQualityGateArticle(article, legacyRow);
  const hints = resolveFriendlyQualityFailHints(unified);
  const reasons = Array.isArray(legacyRow?.blockReasons) ? legacyRow.blockReasons : [];
  const compliance = reasons.filter(r => /禁用词|禁止承诺|合规/.test(r));
  const merged = [...compliance, ...hints];
  const unique: string[] = [];
  for (const item of merged) {
    const text = item.trim();
    if (!text || unique.includes(text)) continue;
    unique.push(text);
    if (unique.length >= 5) break;
  }
  if (unique.length > 0) return unique;
  const gate = getContentQualityGateStatus(unified);
  if (!gate.passed && gate.message) return [gate.message];
  return [];
}

export function buildUnifiedQualityGateArticle(
  article: GeoQualityDisplayArticle,
  legacyRow?: GeoLegacyQualityScoreRow | null,
): GeoQualityDisplayArticle {
  const score = resolveEffectiveGeoQualityScore(article, legacyRow);
  const recommendation = resolveEffectiveGeoQualityRecommendation(article, legacyRow, score);
  const blockReasons = Array.isArray(legacyRow?.blockReasons) ? legacyRow.blockReasons : [];
  const complianceBlocked = hasComplianceBlockReasons(blockReasons);
  const stale = isGeoQualityScoreStale(article);
  const qualityPasses =
    !stale &&
    score != null &&
    score >= GEO_ARTICLE_MIN_PASS_SCORE &&
    recommendation !== "reject" &&
    !complianceBlocked &&
    !legacyRow?.blocked;

  return {
    ...article,
    geoQualityScore: score,
    geoQualityRecommendation: recommendation ?? article.geoQualityRecommendation,
    qualityPasses,
    qualityStatus: qualityPasses ? "passed" : article.qualityStatus,
  };
}

function parseGeoQualityDetail(detail: unknown): GeoQualityReviewResult | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as GeoQualityReviewResult;
  if (d.scores && typeof d.total === "number" && d.recommendation) return d;
  return null;
}

const DIMENSION_FRIENDLY_HINTS: Record<GeoQualityDimensionKey, string> = {
  brand_entity: "建议在前文明确品牌与产品名称",
  question_match: "建议围绕目标问题调整段落结构",
  ai_citable_structure: "建议增加 FAQ 与可引用短答案",
  case_evidence: "建议补充案例内容",
  competitor_comparison: "建议补充竞品对比或差异化说明",
  platform_friendly: "建议按平台习惯优化标题与分段",
};

const TECHNICAL_QUALITY_PATTERNS =
  /\b(publish|revise|reject|json|undefined|null|stack|error|trpc|sql)\b/i;

function isTechnicalQualityText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (TECHNICAL_QUALITY_PATTERNS.test(trimmed)) return true;
  return looksLikeInternalTechnicalError(trimmed);
}

function pushHint(hints: string[], text: string) {
  const friendly = toUserFacingError(text, "").trim();
  if (!friendly || isTechnicalQualityText(friendly)) return;
  if (!hints.includes(friendly)) hints.push(friendly);
}

/** 质检未通过时的客户可读原因（最多 3 条） */
export function resolveFriendlyQualityFailHints(article: GeoQualityDisplayArticle): string[] {
  const gate = getContentQualityGateStatus(article);
  if (gate.passed) return [];

  if (isGeoQualityScoreStale(article)) {
    return ["正文已修改，请重新质检后再发布"];
  }

  const hints: string[] = [];
  const detail = parseGeoQualityDetail(article.geoQualityDetail);

  if (detail?.suggestions?.length) {
    for (const suggestion of detail.suggestions) {
      pushHint(hints, suggestion);
      if (hints.length >= 3) return hints;
    }
  }

  if (detail?.scores) {
    for (const key of GEO_QUALITY_DIMENSION_ORDER) {
      const dim = detail.scores[key];
      if (!dim || dim.max <= 0) continue;
      const ratio = dim.score / dim.max;
      if (ratio >= 0.6) continue;

      const reason = (dim.reason ?? "").trim();
      if (reason && !isTechnicalQualityText(reason)) {
        pushHint(hints, reason);
      } else {
        const label = GEO_QUALITY_DIMENSION_META[key]?.label ?? key;
        pushHint(hints, DIMENSION_FRIENDLY_HINTS[key] ?? `建议优化「${label}」相关段落`);
      }
      if (hints.length >= 3) return hints;
    }
  }

  if (hints.length === 0) {
    if (gate.reason === "missing") {
      hints.push("请先完成发布前质检");
    } else {
      hints.push("请根据质检建议修订正文后重新质检");
    }
  }

  return hints.slice(0, 3);
}

export function resolveQualityCardView(
  article: GeoQualityDisplayArticle,
  legacyRow?: GeoLegacyQualityScoreRow | null,
): GeoQualityCardView | null {
  const unified = buildUnifiedQualityGateArticle(article, legacyRow);
  const score = unified.geoQualityScore;
  const recommendation = unified.geoQualityRecommendation;
  if (score == null || !recommendation) return null;
  const staleLabel = isGeoQualityScoreStale(unified) ? "待重新质检" : null;
  return {
    score,
    tier: getGeoQualityScoreTier(score),
    staleLabel,
  };
}

/** 列表顶部平均质检分（仅统计有真实分数的卡片） */
export function computeAverageGeoQualityScore(scores: Array<number | null | undefined>): number | null {
  const valid = scores.filter((s): s is number => typeof s === "number" && Number.isFinite(s));
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, n) => acc + n, 0);
  return Math.round(sum / valid.length);
}

/** 兼容旧字符串展示（测试 / 日志） */
export function resolveQualityDisplay(article: GeoQualityDisplayArticle): string | null {
  const view = resolveQualityCardView(article);
  if (!view) return null;
  const stale = view.staleLabel ? ` · ${view.staleLabel}` : "";
  return `${view.score} 分 · ${view.tier.label}${stale}`;
}
