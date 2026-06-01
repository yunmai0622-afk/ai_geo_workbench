/** 来自 geo_article_quality_scores 表的分项字段（不含合规分，面向客户展示五项细则） */
export type GeoArticleQualityScoreRow = {
  problemMatchScore?: number | null;
  evidenceScore?: number | null;
  structureScore?: number | null;
  originalityScore?: number | null;
  geoCitableScore?: number | null;
  totalScore?: number | null;
};

export type GeoArticleQualityDimensionDisplay = {
  label: string;
  score: number;
};

export const GEO_ARTICLE_QUALITY_DIMENSION_SPECS = [
  { field: "originalityScore" as const, label: "实体清晰度" },
  { field: "problemMatchScore" as const, label: "场景关联度" },
  { field: "evidenceScore" as const, label: "证据充分度" },
  { field: "structureScore" as const, label: "结构化程度" },
  { field: "geoCitableScore" as const, label: "可引用性" },
] as const;

export function buildGeoArticleQualityDimensionDisplays(
  row: GeoArticleQualityScoreRow | null | undefined,
): GeoArticleQualityDimensionDisplay[] | null {
  if (!row) return null;
  const displays: GeoArticleQualityDimensionDisplay[] = [];
  for (const spec of GEO_ARTICLE_QUALITY_DIMENSION_SPECS) {
    const raw = row[spec.field];
    if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
    displays.push({ label: spec.label, score: raw });
  }
  return displays;
}

export function formatGeoArticleQualityDimensionLine(dim: GeoArticleQualityDimensionDisplay): string {
  return `${dim.label}：${dim.score}分`;
}

export function hasGeoArticleQualityScoreDetail(row: GeoArticleQualityScoreRow | null | undefined): boolean {
  return buildGeoArticleQualityDimensionDisplays(row) != null;
}
