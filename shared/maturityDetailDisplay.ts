/**
 * GEO-V2.0-P0-F：成熟度详情页展示辅助（状态、缺口、关联入口）
 */

import {
  GEO_MATURITY_DIMENSION_META,
  type GeoMaturityDimensionKey,
  type GeoMaturityReport,
} from "./geoMaturityScoring";

export type MaturityDimensionStatus = "优秀" | "良好" | "待改善" | "未建立";

export function resolveMaturityDimensionStatus(score: number): MaturityDimensionStatus {
  if (score >= 80) return "优秀";
  if (score >= 60) return "良好";
  if (score >= 20) return "待改善";
  return "未建立";
}

/** 客户可读的一句话结论（按分数区间，不改计算逻辑） */
export function resolveMaturityDimensionConclusion(score: number): string {
  if (score >= 81) return "优秀";
  if (score >= 61) return "良好，可进一步强化";
  if (score >= 41) return "基础具备，仍有较大提升空间";
  if (score >= 21) return "明显不足，需优先补充";
  return "暂无数据/严重不足";
}

export const MATURITY_DIMENSION_ENTRY: Record<
  GeoMaturityDimensionKey,
  { ctaLabel: string; path: string }
> = {
  brandIdentity: { ctaLabel: "去完善建档", path: "/enterprise-profile" },
  categoryPositioning: { ctaLabel: "去完善建档", path: "/enterprise-profile" },
  questionCoverage: { ctaLabel: "去问题池", path: "/questions" },
  sourceGraph: { ctaLabel: "去信源图谱", path: "/brand-source-graph" },
  trustEvidence: { ctaLabel: "去添加证据", path: "/enterprise-profile?step=6" },
  aiTestPerformance: { ctaLabel: "去发起实测", path: "/ai-diagnosis" },
};

const DIMENSION_DETAIL_KEY: Record<GeoMaturityDimensionKey, string> = {
  brandIdentity: "brandIdentity",
  categoryPositioning: "categoryPositioning",
  questionCoverage: "questionCoverage",
  sourceGraph: "sourceGraph",
  trustEvidence: "trustEvidence",
  aiTestPerformance: "aiTestPerformance",
};

const DIMENSION_GAP_HINTS: Record<GeoMaturityDimensionKey, string[]> = {
  brandIdentity: ["补充品牌名、官网与一句话介绍", "核对实体一致性检查项"],
  categoryPositioning: ["补充行业标签与产品描述", "完善核心卖点与竞品差异"],
  questionCoverage: ["扩充启用问题数量", "覆盖 6 类搜索场景"],
  sourceGraph: ["补充官网与知乎/小红书信源", "争取 AI 引用确认"],
  trustEvidence: ["积累已验证信任证据", "补充客户案例佐证"],
  aiTestPerformance: ["运行 AI 实测批次", "提升品牌提及与推荐率"],
};

const DIMENSION_ACTION_HINTS: Record<GeoMaturityDimensionKey, string> = {
  brandIdentity: "完善品牌名、官网与一句话介绍，并核对实体一致性",
  categoryPositioning: "补充行业标签、产品描述、核心卖点与竞品差异",
  questionCoverage: "扩充启用问题池至 30 题，并覆盖 6 类搜索场景",
  sourceGraph: "补充官网、知乎/小红书信源，争取 AI 引用确认",
  trustEvidence: "积累已验证信任证据与客户案例",
  aiTestPerformance: "运行 AI 实测并提升品牌提及与推荐率",
};

export type MaturityDimensionDetailCard = {
  key: GeoMaturityDimensionKey;
  label: string;
  score: number;
  maxScore: number;
  status: MaturityDimensionStatus;
  conclusion: string;
  gaps: string[];
  action: string;
  ctaLabel: string;
  path: string;
};

export type MaturityWeaknessHighlight = {
  key: GeoMaturityDimensionKey;
  label: string;
  score: number;
  conclusion: string;
  action: string;
  ctaLabel: string;
  path: string;
};

export function buildMaturityDimensionDetailCards(
  report: GeoMaturityReport,
  calculationDetail?: Record<string, unknown> | null,
): MaturityDimensionDetailCard[] {
  const detail = calculationDetail ?? {};
  return GEO_MATURITY_DIMENSION_META.map(meta => {
    const dimension = report.dimensions.find(d => d.key === meta.key);
    const score = dimension?.score ?? 0;
    const gaps = resolveDimensionGaps(meta.key, score, detail[meta.key]);
    return {
      key: meta.key,
      label: meta.label,
      score,
      maxScore: 100,
      status: resolveMaturityDimensionStatus(score),
      conclusion: resolveMaturityDimensionConclusion(score),
      gaps,
      action: DIMENSION_ACTION_HINTS[meta.key],
      ...MATURITY_DIMENSION_ENTRY[meta.key],
    };
  });
}

export function buildTopWeaknessHighlights(
  report: GeoMaturityReport,
  calculationDetail?: Record<string, unknown> | null,
  limit = 3,
): MaturityWeaknessHighlight[] {
  const cards = buildMaturityDimensionDetailCards(report, calculationDetail);
  return [...cards]
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(card => ({
      key: card.key,
      label: card.label,
      score: card.score,
      conclusion: card.conclusion,
      action: card.action,
      ctaLabel: card.ctaLabel,
      path: card.path,
    }));
}

function resolveDimensionGaps(
  key: GeoMaturityDimensionKey,
  score: number,
  rawDetail: unknown,
): string[] {
  const hints = [...DIMENSION_GAP_HINTS[key]];
  if (score >= 80) {
    return hints.slice(0, 1).map(h => `保持：${h}`);
  }
  const custom = extractGapsFromDetail(key, rawDetail);
  if (custom.length > 0) return custom.slice(0, 2);
  return hints.slice(0, 2);
}

function extractGapsFromDetail(key: GeoMaturityDimensionKey, rawDetail: unknown): string[] {
  if (!rawDetail || typeof rawDetail !== "object") return [];
  const detail = rawDetail as Record<string, unknown>;
  const gaps: string[] = [];

  if (key === "brandIdentity") {
    if (!detail.brandName) gaps.push("缺少品牌名称");
    if (!detail.officialWebsite) gaps.push("缺少官网链接");
    if (!detail.oneLiner) gaps.push("缺少一句话介绍");
  }
  if (key === "categoryPositioning") {
    if (!detail.industryTag) gaps.push("缺少行业标签");
    if (!detail.productDesc) gaps.push("缺少产品描述");
    if (!detail.keyPoints) gaps.push("核心卖点不足 3 条");
  }
  if (key === "questionCoverage" && typeof detail.enabledCount === "number") {
    gaps.push(`当前启用问题 ${detail.enabledCount} 题`);
    if (typeof detail.coveredTypeCount === "number" && typeof detail.targetTypeCount === "number") {
      gaps.push(`搜索场景覆盖 ${detail.coveredTypeCount}/${detail.targetTypeCount}`);
    }
  }
  if (key === "sourceGraph" && typeof detail.sourceCount === "number") {
    gaps.push(`当前信源 ${detail.sourceCount} 条`);
  }
  if (key === "trustEvidence" && detail.breakdown && typeof detail.breakdown === "object") {
    const breakdown = detail.breakdown as Record<string, unknown>;
    if (typeof breakdown.verifiedCount === "number") {
      gaps.push(`已验证证据 ${breakdown.verifiedCount} 条`);
    }
  }
  if (key === "aiTestPerformance" && typeof detail.totalRuns === "number") {
    if (detail.totalRuns === 0) gaps.push("尚未完成 AI 实测");
    else gaps.push(`实测样本 ${detail.totalRuns} 条`);
  }

  return gaps;
}

export type MaturityNextActionItem = {
  title: string;
  description: string;
  ctaLabel: string;
  path: string;
  dimensionKey: GeoMaturityDimensionKey;
};

export function buildMaturityNextActionItems(report: GeoMaturityReport): MaturityNextActionItem[] {
  const sorted = [...report.dimensions].sort((a, b) => a.score - b.score);
  return sorted.slice(0, 3).map(dimension => ({
    title: `优先提升：${dimension.label}`,
    description:
      report.nextActions.find((_, index) => sorted[index]?.key === dimension.key) ??
      DIMENSION_ACTION_HINTS[dimension.key],
    ctaLabel: MATURITY_DIMENSION_ENTRY[dimension.key].ctaLabel,
    path: MATURITY_DIMENSION_ENTRY[dimension.key].path,
    dimensionKey: dimension.key,
  }));
}

export function resolveWeakestDimension(report: GeoMaturityReport | null | undefined) {
  if (!report || report.dimensions.length === 0) return null;
  const sorted = [...report.dimensions].sort((a, b) => a.score - b.score);
  return sorted[0] ?? null;
}

/** 成熟度页「改善最弱短板」主按钮文案（按维度动态生成） */
export function resolveMaturityWeakestPrimaryCtaLabel(key: GeoMaturityDimensionKey): string {
  switch (key) {
    case "trustEvidence":
      return "去添加信任证据";
    case "aiTestPerformance":
      return "去做AI现状检测";
    case "sourceGraph":
      return "去完善信源图谱";
    case "questionCoverage":
      return "去完善问题池";
    case "brandIdentity":
    case "categoryPositioning":
      return "去完善品牌资料";
    default:
      return "去改善最弱短板";
  }
}

export function resolveWeakestDimensionAction(
  report: GeoMaturityReport | null | undefined,
  calculationDetail?: Record<string, unknown> | null,
): MaturityWeaknessHighlight | null {
  if (!report) return null;
  return buildTopWeaknessHighlights(report, calculationDetail, 1)[0] ?? null;
}

export function dimensionDetailStorageKey(key: GeoMaturityDimensionKey): string {
  return DIMENSION_DETAIL_KEY[key];
}
