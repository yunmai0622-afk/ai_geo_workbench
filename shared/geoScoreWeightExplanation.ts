export type GeoScoreWeightExplanationItem = {
  label: string;
  weightPercent: number;
  description: string;
};

/** 客户可见的 GEO 总分权重说明（工作台展示用） */
export const GEO_SCORE_WEIGHT_EXPLANATION_ITEMS: GeoScoreWeightExplanationItem[] = [
  { label: "品牌识别率", weightPercent: 30, description: "AI是否知道你的品牌" },
  { label: "内容覆盖度", weightPercent: 25, description: "发布内容的数量和质量" },
  { label: "平台分布", weightPercent: 20, description: "覆盖了多少个独立平台" },
  { label: "AI推荐率", weightPercent: 25, description: "AI是否主动推荐你" },
];

export function formatGeoScoreWeightExplanationLine(item: GeoScoreWeightExplanationItem): string {
  return `${item.label}（${item.weightPercent}%）：${item.description}`;
}
