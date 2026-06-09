/**
 * GEO-V2.0-P0-E：AI 品牌成熟度 6 维评分（纯规则计算，不调 AI API）
 */

import { SEARCH_POOL_QUESTION_TYPES } from "./questionSearchPool";
import { computeTrustEvidenceMaturityScore } from "./trustEvidence";

export const GEO_MATURITY_DIMENSION_WEIGHTS = {
  brandIdentity: 0.15,
  categoryPositioning: 0.15,
  questionCoverage: 0.15,
  sourceGraph: 0.2,
  trustEvidence: 0.2,
  aiTestPerformance: 0.15,
} as const;

export const GEO_MATURITY_DIMENSION_META = [
  {
    key: "brandIdentity",
    label: "品牌实体清晰度",
    weight: GEO_MATURITY_DIMENSION_WEIGHTS.brandIdentity,
    field: "brandIdentityScore" as const,
  },
  {
    key: "categoryPositioning",
    label: "品类定位清晰度",
    weight: GEO_MATURITY_DIMENSION_WEIGHTS.categoryPositioning,
    field: "categoryPositioningScore" as const,
  },
  {
    key: "questionCoverage",
    label: "搜索问题覆盖度",
    weight: GEO_MATURITY_DIMENSION_WEIGHTS.questionCoverage,
    field: "questionCoverageScore" as const,
  },
  {
    key: "sourceGraph",
    label: "公开信源完整度",
    weight: GEO_MATURITY_DIMENSION_WEIGHTS.sourceGraph,
    field: "sourceGraphScore" as const,
  },
  {
    key: "trustEvidence",
    label: "信任证据强度",
    weight: GEO_MATURITY_DIMENSION_WEIGHTS.trustEvidence,
    field: "trustEvidenceScore" as const,
  },
  {
    key: "aiTestPerformance",
    label: "AI实测表现",
    weight: GEO_MATURITY_DIMENSION_WEIGHTS.aiTestPerformance,
    field: "aiTestPerformanceScore" as const,
  },
] as const;

export type GeoMaturityDimensionKey = (typeof GEO_MATURITY_DIMENSION_META)[number]["key"];

export type GeoMaturityStage = {
  stage: string;
  stageDesc: string;
};

export type GeoMaturityDimensionReport = {
  key: GeoMaturityDimensionKey;
  label: string;
  score: number;
  weight: number;
  weightPercent: number;
};

export type GeoMaturityReport = {
  totalScore: number;
  stage: string;
  stageDesc: string;
  dimensions: GeoMaturityDimensionReport[];
  topWeaknesses: string[];
  nextActions: string[];
  calculatedAt: string;
};

export type GeoMaturityScores = {
  brandIdentityScore: number;
  categoryPositioningScore: number;
  questionCoverageScore: number;
  sourceGraphScore: number;
  trustEvidenceScore: number;
  aiTestPerformanceScore: number;
  totalScore: number;
  calculationDetail: Record<string, unknown>;
};

type ProfileLike = Record<string, unknown> | null | undefined;

type EntityCheckLike = { status: string };

type BrandSourceLike = {
  platform?: string | null;
  containsOfficialSite?: boolean | null;
  aiCitationConfirmed?: boolean | null;
};

type QuestionLike = {
  enabled?: number | boolean | null;
  searchPoolType?: string | null;
};

type AiTestRunLike = {
  mentionedCompany?: boolean | null;
  recommendedCompany?: boolean | null;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(v => String(v).trim()).filter(Boolean);
}

function resolveBrandName(profile: ProfileLike): string {
  return trim(profile?.brandName) || trim(profile?.enterpriseName);
}

function isQuestionEnabled(question: QuestionLike): boolean {
  const enabled = question.enabled;
  if (typeof enabled === "boolean") return enabled;
  return enabled === 1;
}

export function resolveEntityConsistencyBonus(checks: EntityCheckLike[]): {
  points: number;
  status: "all_consistent" | "partial_consistent" | "all_missing" | "none";
} {
  if (checks.length === 0) {
    return { points: 0, status: "none" };
  }
  const consistentCount = checks.filter(c => c.status === "consistent").length;
  const missingCount = checks.filter(c => c.status === "missing").length;
  if (consistentCount === checks.length) {
    return { points: 30, status: "all_consistent" };
  }
  if (missingCount === checks.length) {
    return { points: 0, status: "all_missing" };
  }
  if (consistentCount > 0) {
    return { points: 15, status: "partial_consistent" };
  }
  return { points: 0, status: "all_missing" };
}

export function calculateBrandIdentityScore(input: {
  profile: ProfileLike;
  entityChecks: EntityCheckLike[];
  brandSourceCount: number;
}): { score: number; detail: Record<string, unknown> } {
  const profile = input.profile ?? {};
  let score = 0;
  const breakdown: Record<string, unknown> = {};

  const hasBrandName = Boolean(resolveBrandName(profile));
  if (hasBrandName) {
    score += 20;
    breakdown.brandName = 20;
  }

  const hasOfficialWebsite = Boolean(trim(profile.officialWebsite));
  if (hasOfficialWebsite) {
    score += 20;
    breakdown.officialWebsite = 20;
  }

  const hasOneLiner = Boolean(trim(profile.oneLiner));
  if (hasOneLiner) {
    score += 15;
    breakdown.oneLiner = 15;
  }

  const consistency = resolveEntityConsistencyBonus(input.entityChecks);
  score += consistency.points;
  breakdown.entityConsistency = consistency;

  if (input.brandSourceCount >= 3) {
    score += 15;
    breakdown.brandSourceRecords = 15;
  }

  return { score: clampScore(score), detail: breakdown };
}

export function calculateCategoryPositioningScore(profile: ProfileLike): {
  score: number;
  detail: Record<string, unknown>;
} {
  const p = profile ?? {};
  let score = 0;
  const breakdown: Record<string, unknown> = {};

  if (trim(p.industryTag)) {
    score += 20;
    breakdown.industryTag = 20;
  }
  if (trim(p.productDesc) || trim(p.productServiceIntro) || trim(p.productIntro)) {
    score += 20;
    breakdown.productDesc = 20;
  }
  if (stringArray(p.keyPoints).length >= 3) {
    score += 20;
    breakdown.keyPoints = 20;
  }
  if (stringArray(p.keywords).length >= 3) {
    score += 20;
    breakdown.keywords = 20;
  }
  if (trim(p.competitorDifference)) {
    score += 20;
    breakdown.competitorDifference = 20;
  }

  return { score: clampScore(score), detail: breakdown };
}

export function calculateQuestionCoverageScore(questions: QuestionLike[]): {
  score: number;
  detail: Record<string, unknown>;
} {
  const enabledQuestions = questions.filter(isQuestionEnabled);
  const enabledCount = enabledQuestions.length;

  let baseScore = 0;
  if (enabledCount >= 30) baseScore = 100;
  else if (enabledCount >= 20) baseScore = 80;
  else if (enabledCount >= 10) baseScore = 60;
  else if (enabledCount >= 5) baseScore = 40;
  else if (enabledCount >= 1) baseScore = 20;

  const coveredTypes = SEARCH_POOL_QUESTION_TYPES.filter(type =>
    enabledQuestions.some(q => q.searchPoolType === type.value),
  );
  const allSixCovered = coveredTypes.length === SEARCH_POOL_QUESTION_TYPES.length;
  const categoryBonus = allSixCovered ? 10 : 0;
  const score = clampScore(baseScore + categoryBonus);

  return {
    score,
    detail: {
      enabledCount,
      baseScore,
      categoryBonus,
      coveredTypeCount: coveredTypes.length,
      targetTypeCount: SEARCH_POOL_QUESTION_TYPES.length,
      coveredTypes: coveredTypes.map(t => t.value),
    },
  };
}

function hasOfficialSiteSource(sources: BrandSourceLike[]): boolean {
  return sources.some(
    s =>
      s.platform === "official_site" ||
      s.containsOfficialSite === true,
  );
}

function hasZhihuOrXiaohongshuSource(sources: BrandSourceLike[]): boolean {
  return sources.some(s => s.platform === "zhihu" || s.platform === "xiaohongshu");
}

export function calculateSourceGraphScore(sources: BrandSourceLike[]): {
  score: number;
  detail: Record<string, unknown>;
} {
  const count = sources.length;
  let baseScore = 0;
  if (count >= 8) baseScore = 100;
  else if (count >= 5) baseScore = 80;
  else if (count >= 3) baseScore = 60;
  else if (count >= 1) baseScore = 30;

  let bonus = 0;
  const bonuses: Record<string, number> = {};
  if (hasOfficialSiteSource(sources)) {
    bonus += 10;
    bonuses.officialSite = 10;
  }
  if (hasZhihuOrXiaohongshuSource(sources)) {
    bonus += 10;
    bonuses.zhihuOrXiaohongshu = 10;
  }
  if (sources.some(s => s.aiCitationConfirmed === true)) {
    bonus += 10;
    bonuses.aiCitationConfirmed = 10;
  }

  return {
    score: clampScore(baseScore + bonus),
    detail: {
      sourceCount: count,
      baseScore,
      bonuses,
      totalBonus: bonus,
    },
  };
}

export function calculateTrustEvidenceDimensionScore(input: {
  verifiedCount: number;
  draftCount: number;
  rejectedCount: number;
  totalTrustEvidenceCount: number;
  customerCaseCount: number;
}): { score: number; detail: Record<string, unknown> } {
  const result = computeTrustEvidenceMaturityScore(input);
  return {
    score: result.score,
    detail: {
      breakdown: result.breakdown,
      suggestions: result.suggestions,
    },
  };
}

export function calculateAiTestPerformanceScore(runs: AiTestRunLike[]): {
  score: number;
  detail: Record<string, unknown>;
} {
  if (runs.length === 0) {
    return { score: 0, detail: { totalRuns: 0, mentionRate: 0, recommendRate: 0 } };
  }
  const mentionedCount = runs.filter(r => r.mentionedCompany === true).length;
  const recommendedCount = runs.filter(r => r.recommendedCompany === true).length;
  const mentionRate = mentionedCount / runs.length;
  const recommendRate = recommendedCount / runs.length;
  const score = clampScore(mentionRate * 60 + recommendRate * 40);
  return {
    score,
    detail: {
      totalRuns: runs.length,
      mentionedCount,
      recommendedCount,
      mentionRate: Math.round(mentionRate * 100),
      recommendRate: Math.round(recommendRate * 100),
    },
  };
}

export function calculateWeightedTotalScore(dimensions: GeoMaturityScores): number {
  const weighted =
    dimensions.brandIdentityScore * GEO_MATURITY_DIMENSION_WEIGHTS.brandIdentity +
    dimensions.categoryPositioningScore * GEO_MATURITY_DIMENSION_WEIGHTS.categoryPositioning +
    dimensions.questionCoverageScore * GEO_MATURITY_DIMENSION_WEIGHTS.questionCoverage +
    dimensions.sourceGraphScore * GEO_MATURITY_DIMENSION_WEIGHTS.sourceGraph +
    dimensions.trustEvidenceScore * GEO_MATURITY_DIMENSION_WEIGHTS.trustEvidence +
    dimensions.aiTestPerformanceScore * GEO_MATURITY_DIMENSION_WEIGHTS.aiTestPerformance;
  return clampScore(weighted);
}

export function resolveMaturityStage(totalScore: number): GeoMaturityStage {
  if (totalScore <= 20) {
    return {
      stage: "AI盲区期",
      stageDesc: "AI 几乎不知道这家企业的存在",
    };
  }
  if (totalScore <= 40) {
    return {
      stage: "初步建档期",
      stageDesc: "AI 能识别品牌，但理解不深",
    };
  }
  if (totalScore <= 60) {
    return {
      stage: "信源建设期",
      stageDesc: "AI 开始能找到企业信息，但证据不足",
    };
  }
  if (totalScore <= 80) {
    return {
      stage: "可见增长期",
      stageDesc: "AI 在相关问题中开始提及企业",
    };
  }
  return {
    stage: "稳定推荐期",
    stageDesc: "AI 在多个平台稳定提及并推荐企业",
  };
}

const DIMENSION_ACTIONS: Record<GeoMaturityDimensionKey, string> = {
  brandIdentity: "完善品牌名、官网与一句话介绍，并核对实体一致性",
  categoryPositioning: "补充行业标签、产品描述、核心卖点与竞品差异",
  questionCoverage: "扩充启用问题池至 30 题，并覆盖 6 类搜索场景",
  sourceGraph: "补充官网、知乎/小红书信源，争取 AI 引用确认",
  trustEvidence: "积累已验证信任证据与客户案例",
  aiTestPerformance: "运行 AI 实测并提升品牌提及与推荐率",
};

export function buildMaturityReport(input: {
  scores: GeoMaturityScores;
  calculatedAt: Date | string;
}): GeoMaturityReport {
  const { scores, calculatedAt } = input;
  const stageInfo = resolveMaturityStage(scores.totalScore);

  const dimensions: GeoMaturityDimensionReport[] = GEO_MATURITY_DIMENSION_META.map(meta => ({
    key: meta.key,
    label: meta.label,
    score: scores[meta.field] ?? 0,
    weight: meta.weight,
    weightPercent: Math.round(meta.weight * 100),
  }));

  const sortedByScore = [...dimensions].sort((a, b) => a.score - b.score);
  const topWeaknesses = sortedByScore.slice(0, 3).map(d => `${d.label}（${d.score} 分）`);
  const nextActions = sortedByScore
    .slice(0, 3)
    .map(d => DIMENSION_ACTIONS[d.key])
    .filter(Boolean);

  const calculatedAtIso =
    calculatedAt instanceof Date ? calculatedAt.toISOString() : new Date(calculatedAt).toISOString();

  return {
    totalScore: scores.totalScore,
    stage: stageInfo.stage,
    stageDesc: stageInfo.stageDesc,
    dimensions,
    topWeaknesses,
    nextActions,
    calculatedAt: calculatedAtIso,
  };
}

export function calculateGeoMaturityScores(input: {
  profile: ProfileLike;
  entityChecks: EntityCheckLike[];
  brandSources: BrandSourceLike[];
  questions: QuestionLike[];
  trustEvidence: {
    verifiedCount: number;
    draftCount: number;
    rejectedCount: number;
    totalTrustEvidenceCount: number;
    customerCaseCount: number;
  };
  aiTestRuns: AiTestRunLike[];
}): GeoMaturityScores {
  const brandIdentity = calculateBrandIdentityScore({
    profile: input.profile,
    entityChecks: input.entityChecks,
    brandSourceCount: input.brandSources.length,
  });
  const categoryPositioning = calculateCategoryPositioningScore(input.profile);
  const questionCoverage = calculateQuestionCoverageScore(input.questions);
  const sourceGraph = calculateSourceGraphScore(input.brandSources);
  const trustEvidence = calculateTrustEvidenceDimensionScore(input.trustEvidence);
  const aiTestPerformance = calculateAiTestPerformanceScore(input.aiTestRuns);

  const dimensionScores = {
    brandIdentityScore: brandIdentity.score,
    categoryPositioningScore: categoryPositioning.score,
    questionCoverageScore: questionCoverage.score,
    sourceGraphScore: sourceGraph.score,
    trustEvidenceScore: trustEvidence.score,
    aiTestPerformanceScore: aiTestPerformance.score,
  };

  const totalScore = calculateWeightedTotalScore({
    ...dimensionScores,
    totalScore: 0,
    calculationDetail: {},
  });

  return {
    ...dimensionScores,
    totalScore,
    calculationDetail: {
      brandIdentity: brandIdentity.detail,
      categoryPositioning: categoryPositioning.detail,
      questionCoverage: questionCoverage.detail,
      sourceGraph: sourceGraph.detail,
      trustEvidence: trustEvidence.detail,
      aiTestPerformance: aiTestPerformance.detail,
      weights: GEO_MATURITY_DIMENSION_WEIGHTS,
    },
  };
}
