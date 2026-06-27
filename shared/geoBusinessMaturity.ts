export const GEO_BUSINESS_MATURITY_WEIGHTS = {
  profile: 0.15,
  questionCoverage: 0.15,
  aiVisibility: 0.2,
  sourceConsistency: 0.15,
  contentExecution: 0.2,
  retestDelivery: 0.15,
} as const;

export type GeoBusinessMaturityDimensionKey = keyof typeof GEO_BUSINESS_MATURITY_WEIGHTS;

export type GeoBusinessMaturityStatus = "good" | "warning" | "poor";

export type GeoBusinessMaturityLevel =
  | "基础薄弱"
  | "初步建立"
  | "基础成型"
  | "增长优化中"
  | "高可见度品牌";

export type GeoBusinessMaturityDimension = {
  key: GeoBusinessMaturityDimensionKey;
  name: string;
  score: number;
  status: GeoBusinessMaturityStatus;
  explanation: string;
  evidence: string[];
  nextAction: string;
};

export type GeoBusinessMaturityReport = {
  projectId: number;
  enterpriseName: string | null;
  totalScore: number;
  level: GeoBusinessMaturityLevel;
  summary: string;
  dimensions: GeoBusinessMaturityDimension[];
  topWeaknesses: GeoBusinessMaturityDimension[];
  nextAction: string;
  generatedAt: string;
};

export type GeoBusinessMaturityInput = {
  projectId: number;
  enterpriseName?: string | null;
  profile: {
    enterpriseName?: string | null;
    brandName?: string | null;
    officialWebsite?: string | null;
    oneLiner?: string | null;
    industry?: string | null;
    industryTag?: string | null;
    productDesc?: string | null;
    productServiceIntro?: string | null;
    targetCustomers?: string | null;
    coreSellingPoints?: string | null;
    competitorDifference?: string | null;
    completionScore?: number | null;
    keyPoints?: string[] | null;
    keywords?: string[] | null;
  } | null;
  questionStats: {
    totalCount: number;
    enabledCount: number;
    coveredTypeCount: number;
    targetTypeCount: number;
    contentLinkedCount: number;
    highPriorityCount: number;
  };
  aiTestStats: {
    totalRuns: number;
    mentionedCount: number;
    recommendedCount: number;
    sourceLinkCount: number;
    competitorMentionedCount: number;
  };
  sourceStats: {
    brandSourceCount: number;
    platformCount: number;
    officialSourceCount: number;
    aiCitationConfirmedCount: number;
    entityCheckCount: number;
    entityConsistentCount: number;
    verifiedTrustEvidenceCount: number;
    customerCaseCount: number;
  };
  contentStats: {
    optimizationTaskCount: number;
    monthlyTaskCount: number;
    completedMonthlyTaskCount: number;
    articleTopicCount: number;
    articleCount: number;
    publishedArticleCount: number;
    publishRecordCount: number;
    publishTaskCount: number;
    completedPublishTaskCount: number;
  };
  retestStats: {
    baselineRoundCount: number;
    retestRoundCount: number;
    completedRetestRoundCount: number;
    inclusionRecordCount: number;
    inclusionVerifiedCount: number;
    aiMentionMonitoringCount: number;
    reportCount: number;
  };
};

const DIMENSION_NAMES: Record<GeoBusinessMaturityDimensionKey, string> = {
  profile: "品牌档案完整度",
  questionCoverage: "AI 搜索问题覆盖",
  aiVisibility: "AI 可见与推荐表现",
  sourceConsistency: "信源与证据一致性",
  contentExecution: "内容资产执行",
  retestDelivery: "复测与交付证明",
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasList(value: unknown): boolean {
  return Array.isArray(value) && value.some(item => hasText(item));
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

export function resolveGeoBusinessMaturityStatus(score: number): GeoBusinessMaturityStatus {
  if (score >= 75) return "good";
  if (score >= 45) return "warning";
  return "poor";
}

export function resolveGeoBusinessMaturityLevel(totalScore: number): GeoBusinessMaturityLevel {
  if (totalScore >= 90) return "高可见度品牌";
  if (totalScore >= 75) return "增长优化中";
  if (totalScore >= 60) return "基础成型";
  if (totalScore >= 40) return "初步建立";
  return "基础薄弱";
}

function buildProfileDimension(input: GeoBusinessMaturityInput): GeoBusinessMaturityDimension {
  const profile = input.profile;
  const fieldScore = [
    hasText(profile?.enterpriseName) || hasText(profile?.brandName),
    hasText(profile?.officialWebsite),
    hasText(profile?.oneLiner) || hasText(profile?.productDesc) || hasText(profile?.productServiceIntro),
    hasText(profile?.industry) || hasText(profile?.industryTag),
    hasText(profile?.targetCustomers) || hasText(profile?.coreSellingPoints),
    hasText(profile?.competitorDifference) || hasList(profile?.keyPoints) || hasList(profile?.keywords),
  ].filter(Boolean).length * (100 / 6);
  const completionScore = profile?.completionScore ?? null;
  const score = clampScore(completionScore && completionScore > 0 ? Math.max(fieldScore, completionScore) : fieldScore);
  return {
    key: "profile",
    name: DIMENSION_NAMES.profile,
    score,
    status: resolveGeoBusinessMaturityStatus(score),
    explanation: score >= 75 ? "品牌基础信息已经比较完整，AI 更容易识别企业身份与服务边界。" : "品牌基础信息仍有缺口，AI 容易只看到片段信息，难以稳定理解你是谁、服务谁。",
    evidence: [
      hasText(profile?.enterpriseName) || hasText(profile?.brandName) ? "已建立品牌名称" : "品牌名称仍需补齐",
      hasText(profile?.officialWebsite) ? "已登记官网或主站" : "官网或主站信息不足",
      hasText(profile?.oneLiner) || hasText(profile?.productDesc) || hasText(profile?.productServiceIntro)
        ? "已有业务介绍"
        : "业务介绍仍需补齐",
    ],
    nextAction: "补齐品牌一句话、服务对象、核心卖点和差异化描述，让后续内容资产有统一口径。",
  };
}

function buildQuestionCoverageDimension(input: GeoBusinessMaturityInput): GeoBusinessMaturityDimension {
  const stats = input.questionStats;
  const countScore =
    stats.enabledCount >= 50 ? 100 : stats.enabledCount >= 30 ? 85 : stats.enabledCount >= 15 ? 65 : stats.enabledCount >= 5 ? 40 : stats.enabledCount > 0 ? 20 : 0;
  const typeScore = clampScore(pct(stats.coveredTypeCount, Math.max(stats.targetTypeCount, 1)) * 100);
  const linkedScore = clampScore(pct(stats.contentLinkedCount, Math.max(stats.enabledCount, 1)) * 100);
  const score = clampScore(countScore * 0.5 + typeScore * 0.3 + linkedScore * 0.2);
  return {
    key: "questionCoverage",
    name: DIMENSION_NAMES.questionCoverage,
    score,
    status: resolveGeoBusinessMaturityStatus(score),
    explanation: score >= 75 ? "问题池已覆盖较多 AI 搜索场景，并开始连接到内容任务。" : "问题池或内容承接还不够完整，用户在 AI 里提出的关键问题可能没有对应答案资产。",
    evidence: [
      `已启用 ${stats.enabledCount} 个 AI 搜索问题`,
      `覆盖 ${stats.coveredTypeCount}/${stats.targetTypeCount} 类搜索场景`,
      `${stats.contentLinkedCount} 个问题已关联内容任务`,
    ],
    nextAction: "优先补齐高价值问题池，并把未承接的问题转成内容资产任务。",
  };
}

function buildAiVisibilityDimension(input: GeoBusinessMaturityInput): GeoBusinessMaturityDimension {
  const stats = input.aiTestStats;
  const mentionRate = pct(stats.mentionedCount, stats.totalRuns);
  const recommendRate = pct(stats.recommendedCount, stats.totalRuns);
  const sourceRate = pct(stats.sourceLinkCount, stats.totalRuns);
  const score = clampScore(mentionRate * 50 + recommendRate * 40 + sourceRate * 10);
  return {
    key: "aiVisibility",
    name: DIMENSION_NAMES.aiVisibility,
    score,
    status: resolveGeoBusinessMaturityStatus(score),
    explanation: stats.totalRuns === 0
      ? "尚未形成 AI 实测基线，当前无法证明 AI 是否提及或推荐该品牌。"
      : score >= 75
        ? "AI 已能在部分问题中识别并推荐该品牌，后续重点是扩大触发面。"
        : "AI 提及或推荐仍不稳定，需要通过内容与信源持续强化可引用答案。",
    evidence: stats.totalRuns === 0
      ? ["暂无 AI 实测记录"]
      : [
          `AI 实测 ${stats.totalRuns} 次`,
          `提及 ${stats.mentionedCount} 次，推荐 ${stats.recommendedCount} 次`,
          `带来源线索 ${stats.sourceLinkCount} 次`,
        ],
    nextAction: "围绕低提及问题补内容，并在发布后执行 T1/T2/T3 复测确认变化。",
  };
}

function buildSourceConsistencyDimension(input: GeoBusinessMaturityInput): GeoBusinessMaturityDimension {
  const stats = input.sourceStats;
  const sourceScore = stats.brandSourceCount >= 8 ? 40 : stats.brandSourceCount >= 5 ? 32 : stats.brandSourceCount >= 3 ? 24 : stats.brandSourceCount > 0 ? 12 : 0;
  const platformScore = clampScore(Math.min(stats.platformCount, 4) / 4 * 20);
  const evidenceScore = clampScore(Math.min(stats.verifiedTrustEvidenceCount + stats.customerCaseCount, 6) / 6 * 25);
  const entityScore = stats.entityCheckCount > 0 ? clampScore(pct(stats.entityConsistentCount, stats.entityCheckCount) * 15) : 0;
  const score = clampScore(sourceScore + platformScore + evidenceScore + entityScore);
  return {
    key: "sourceConsistency",
    name: DIMENSION_NAMES.sourceConsistency,
    score,
    status: resolveGeoBusinessMaturityStatus(score),
    explanation: score >= 75 ? "公开信源、证明材料和实体一致性已经能支撑 AI 交叉验证。" : "AI 可引用的外部信源和证明材料还不够，容易出现理解不完整或不敢推荐。",
    evidence: [
      `已记录 ${stats.brandSourceCount} 条公开信源，覆盖 ${stats.platformCount} 类平台`,
      `已验证证据 ${stats.verifiedTrustEvidenceCount} 条，客户案例 ${stats.customerCaseCount} 条`,
      stats.entityCheckCount > 0
        ? `实体一致性通过 ${stats.entityConsistentCount}/${stats.entityCheckCount}`
        : "暂无实体一致性校验记录",
    ],
    nextAction: "补充官网、百科/问答、行业平台、客户案例等公开信源，并保持品牌口径一致。",
  };
}

function buildContentExecutionDimension(input: GeoBusinessMaturityInput): GeoBusinessMaturityDimension {
  const stats = input.contentStats;
  const planningScore = stats.monthlyTaskCount > 0 ? Math.min(25, stats.monthlyTaskCount * 8) : 0;
  const topicScore = stats.articleTopicCount > 0 ? Math.min(20, stats.articleTopicCount * 4) : 0;
  const articleScore = stats.articleCount > 0 ? Math.min(30, stats.articleCount * 10) : 0;
  const publishSignal = stats.publishRecordCount + stats.completedPublishTaskCount + stats.publishedArticleCount;
  const publishScore = publishSignal > 0 ? Math.min(25, publishSignal * 8) : 0;
  const score = clampScore(planningScore + topicScore + articleScore + publishScore);
  return {
    key: "contentExecution",
    name: DIMENSION_NAMES.contentExecution,
    score,
    status: resolveGeoBusinessMaturityStatus(score),
    explanation: score >= 75 ? "内容资产已经从计划进入生成和发布闭环，具备持续优化基础。" : "内容资产还没有形成稳定执行闭环，AI 复测缺少可观察的新材料。",
    evidence: [
      `本月计划任务 ${stats.monthlyTaskCount} 项，已完成 ${stats.completedMonthlyTaskCount} 项`,
      `内容主题 ${stats.articleTopicCount} 个，已生成文章 ${stats.articleCount} 篇`,
      `发布记录/已完成发布 ${stats.publishRecordCount + stats.completedPublishTaskCount} 条`,
    ],
    nextAction: "优先推进本月 Top 3 内容任务，从生成、发布到收录监测形成连续证据。",
  };
}

function buildRetestDeliveryDimension(input: GeoBusinessMaturityInput): GeoBusinessMaturityDimension {
  const stats = input.retestStats;
  const baselineScore = stats.baselineRoundCount > 0 ? 20 : 0;
  const retestScore = stats.completedRetestRoundCount > 0 ? 35 : stats.retestRoundCount > 0 ? 20 : 0;
  const inclusionScore = stats.inclusionRecordCount > 0 ? Math.min(25, stats.inclusionRecordCount * 8 + stats.inclusionVerifiedCount * 5) : 0;
  const reportScore = stats.reportCount > 0 ? 20 : 0;
  const score = clampScore(baselineScore + retestScore + inclusionScore + reportScore);
  return {
    key: "retestDelivery",
    name: DIMENSION_NAMES.retestDelivery,
    score,
    status: resolveGeoBusinessMaturityStatus(score),
    explanation: score >= 75 ? "已能把发布、收录、AI 复测与月报证明连起来，具备续费证明基础。" : "复测和交付证明还不完整，后续需要用数据证明优化是否带来变化。",
    evidence: [
      `基线检测 ${stats.baselineRoundCount} 轮，复测 ${stats.completedRetestRoundCount}/${stats.retestRoundCount} 轮完成`,
      `收录/AI 实测监测记录 ${stats.inclusionRecordCount} 条`,
      `交付报告 ${stats.reportCount} 份`,
    ],
    nextAction: "发布后按 7/14/30 天节奏复测，并沉淀为月报证明。",
  };
}

export function buildGeoBusinessMaturityReport(input: GeoBusinessMaturityInput): GeoBusinessMaturityReport {
  const dimensions = [
    buildProfileDimension(input),
    buildQuestionCoverageDimension(input),
    buildAiVisibilityDimension(input),
    buildSourceConsistencyDimension(input),
    buildContentExecutionDimension(input),
    buildRetestDeliveryDimension(input),
  ];
  const totalScore = clampScore(
    dimensions.reduce((sum, dimension) => sum + dimension.score * GEO_BUSINESS_MATURITY_WEIGHTS[dimension.key], 0),
  );
  const level = resolveGeoBusinessMaturityLevel(totalScore);
  const topWeaknesses = [...dimensions].sort((a, b) => a.score - b.score).slice(0, 3);
  const enterpriseName = input.enterpriseName?.trim() || input.profile?.enterpriseName?.trim() || input.profile?.brandName?.trim() || null;
  return {
    projectId: input.projectId,
    enterpriseName,
    totalScore,
    level,
    summary: `${enterpriseName ?? "当前项目"}处于「${level}」阶段，下一步应优先处理 ${topWeaknesses.map(d => d.name).join("、")}。`,
    dimensions,
    topWeaknesses,
    nextAction: topWeaknesses[0]?.nextAction ?? "继续完善品牌资料、内容资产和 AI 复测闭环。",
    generatedAt: new Date().toISOString(),
  };
}
