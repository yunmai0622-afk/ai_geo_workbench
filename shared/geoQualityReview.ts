/** GEO 发布前内容质量评分（C8-A） */

export type GeoQualityRecommendation = "publish" | "revise" | "reject";

export type GeoQualityDimensionKey =
  | "brand_entity"
  | "question_match"
  | "ai_citable_structure"
  | "case_evidence"
  | "competitor_comparison"
  | "platform_friendly";

export type GeoQualityDimension = {
  score: number;
  max: number;
  reason: string;
};

export type GeoQualityReviewResult = {
  scores: Record<GeoQualityDimensionKey, GeoQualityDimension>;
  total: number;
  recommendation: GeoQualityRecommendation;
  suggestions: string[];
};

export const GEO_QUALITY_DIMENSION_META: Record<
  GeoQualityDimensionKey,
  { label: string; max: number }
> = {
  brand_entity: { label: "品牌实体", max: 20 },
  question_match: { label: "问题匹配", max: 20 },
  ai_citable_structure: { label: "AI 可引用结构", max: 20 },
  case_evidence: { label: "案例证据", max: 15 },
  competitor_comparison: { label: "竞品对比", max: 15 },
  platform_friendly: { label: "平台收录友好", max: 10 },
};

export const GEO_QUALITY_DIMENSION_ORDER: GeoQualityDimensionKey[] = [
  "brand_entity",
  "question_match",
  "ai_citable_structure",
  "case_evidence",
  "competitor_comparison",
  "platform_friendly",
];

const DIMENSION_KEYS = GEO_QUALITY_DIMENSION_ORDER;

const DIMENSION_MAX: Record<GeoQualityDimensionKey, number> = {
  brand_entity: 20,
  question_match: 20,
  ai_citable_structure: 20,
  case_evidence: 15,
  competitor_comparison: 15,
  platform_friendly: 10,
};

type RawDimension = { score?: number; reason?: string };
type RawReview = {
  scores?: Partial<Record<GeoQualityDimensionKey, RawDimension>>;
  total?: number;
  recommendation?: string;
  suggestions?: unknown[];
};

export function getGeoQualityRecommendation(total: number): GeoQualityRecommendation {
  if (total >= 80) return "publish";
  if (total >= 60) return "revise";
  return "reject";
}

export function getGeoQualityLabel(recommendation: GeoQualityRecommendation): string {
  switch (recommendation) {
    case "publish":
      return "建议发布";
    case "revise":
      return "建议修改后发布";
    case "reject":
      return "不建议发布";
    default:
      return "待质检";
  }
}

export function extractJsonFromModelText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

export function parseGeoQualityReviewJson(raw: string): RawReview {
  const jsonText = extractJsonFromModelText(raw);
  try {
    return JSON.parse(jsonText) as RawReview;
  } catch {
    throw new Error("质检结果格式异常，请重试");
  }
}

function clampScore(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function normalizeGeoQualityReview(raw: RawReview): GeoQualityReviewResult {
  const scores = {} as Record<GeoQualityDimensionKey, GeoQualityDimension>;
  let total = 0;

  for (const key of DIMENSION_KEYS) {
    const max = DIMENSION_MAX[key];
    const entry = raw.scores?.[key];
    const score = clampScore(Number(entry?.score ?? 0), max);
    const reason = (entry?.reason ?? "").trim() || "未提供说明";
    scores[key] = { score, max, reason };
    total += score;
  }

  const recommendation = getGeoQualityRecommendation(total);
  const suggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map(s => s.trim())
        .slice(0, 8)
    : [];

  return {
    scores,
    total,
    recommendation,
    suggestions,
  };
}

export function parseAndNormalizeGeoQualityReview(raw: string): GeoQualityReviewResult {
  const parsed = parseGeoQualityReviewJson(raw);
  return normalizeGeoQualityReview(parsed);
}
