/** C8-A-Fix：质检评分过期提示文案 */

export const GEO_QUALITY_STALE_EDITOR_HINT =
  "内容已修改，当前评分来自上一次质检，建议重新进行发布前质检。";

export const GEO_QUALITY_STALE_PUBLISH_HINT = "当前内容已修改，建议重新质检后再发布。";

export type GeoQualityStaleFlag = boolean | number | null | undefined;

export function isGeoQualityScoreStale(
  article: {
    geoQualityScore?: number | null;
    geoQualityStale?: GeoQualityStaleFlag;
  } | null | undefined,
): boolean {
  if (article?.geoQualityScore == null) return false;
  return Boolean(article.geoQualityStale);
}

export function shouldBlockPublishForGeoQuality(
  article: {
    geoQualityRecommendation?: string | null;
    geoQualityStale?: GeoQualityStaleFlag;
    geoQualityScore?: number | null;
  } | null | undefined,
): boolean {
  if (!article || isGeoQualityScoreStale(article)) return false;
  return article.geoQualityRecommendation === "reject";
}
