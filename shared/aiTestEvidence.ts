export type AiTestSentiment = "positive" | "neutral" | "negative";
export type AiTestParseStatus = "success" | "partial" | "failed";
export type AiTestStage = "before_publish" | "after_publish" | "manual_check";

const AI_TEST_STAGES: AiTestStage[] = ["before_publish", "after_publish", "manual_check"];

const STAGE_SORT_ORDER: Record<AiTestStage, number> = {
  before_publish: 0,
  after_publish: 1,
  manual_check: 2,
};

export type AiTestCompetitorMention = {
  name: string;
  mentioned: boolean;
  rank?: number | null;
  context?: string;
};

/** 兼容旧字段 + Phase C1-A 扩展字段 */
export type AiTestEvidenceItem = {
  engine: string;
  engineName: string;
  question: string;
  testedAt: string;
  answer: string;
  mentionsBrand: boolean;
  recommendsBrand: boolean;
  recommendationRank: number | null;
  rawAnswer: string;
  mentionedBrand: boolean;
  recommendedBrand: boolean;
  brandRank: number | null;
  citedUrls: string[];
  sentiment: AiTestSentiment;
  competitorMentions: AiTestCompetitorMention[];
  evidenceSummary?: string;
  parseStatus: AiTestParseStatus;
  parseError?: string | null;
  testStage: AiTestStage;
};

export type AiTestStageMetrics = {
  hasData: boolean;
  questionCount: number;
  mentionRate: number | null;
  recommendRate: number | null;
  averageRank: number | null;
  citedUrlCount: number | null;
};

export type AiTestPublishCompare = {
  before: AiTestStageMetrics;
  after: AiTestStageMetrics;
  changes: {
    mentionRateDelta: number | null;
    recommendRateDelta: number | null;
    averageRankDelta: number | null;
    citedUrlCountDelta: number | null;
  };
  hasAnyStageData: boolean;
};

export type AiTestEvidenceAggregate = {
  questionCount: number;
  engineCount: number;
  mentionRate: number;
  recommendRate: number;
  averageRank: number | null;
  sentimentCounts: { positive: number; neutral: number; negative: number };
  competitorMentionCount: number;
  citedUrlCount: number;
  byEngine: Array<{
    engineName: string;
    questionCount: number;
    mentionRate: number;
    recommendRate: number;
    dominantSentiment: AiTestSentiment;
    lastTestedAt: string | null;
  }>;
  keySamples: Array<{
    monitoringRecordId: number;
    resultIndex: number;
    engineName: string;
    question: string;
    mentionedBrand: boolean;
    recommendedBrand: boolean;
    sentiment: AiTestSentiment;
  }>;
  publishCompare: AiTestPublishCompare;
};

export function buildEvidenceDetailPath(monitoringRecordId: number, resultIndex: number) {
  return `/geo/evidence/${monitoringRecordId}/${resultIndex}`;
}

export function sentimentLabelCn(sentiment: AiTestSentiment) {
  if (sentiment === "positive") return "正向";
  if (sentiment === "negative") return "负向";
  return "中性";
}

export function parseStatusLabelCn(status: AiTestParseStatus) {
  if (status === "failed") return "结构化解析未完成";
  if (status === "partial") return "部分结构化解析未完成";
  return "解析完成";
}

export function resolveTestStage(raw: unknown): AiTestStage {
  if (!raw || typeof raw !== "object") return "manual_check";
  const stage = (raw as Record<string, unknown>).testStage;
  if (typeof stage === "string" && (AI_TEST_STAGES as string[]).includes(stage)) {
    return stage as AiTestStage;
  }
  return "manual_check";
}

export function testStageLabelCn(stage: AiTestStage) {
  if (stage === "before_publish") return "发布前测试";
  if (stage === "after_publish") return "发布后复测";
  return "人工复测";
}

/** 同阶段替换、跨阶段保留：合并已有 aiTestResults 与本次实测结果 */
export function mergeAiTestResultsByStage(
  existing: unknown[],
  incoming: AiTestEvidenceItem[],
  stage: AiTestStage,
): AiTestEvidenceItem[] {
  const kept = existing
    .map(raw => normalizeAiTestResult(raw))
    .filter((item): item is AiTestEvidenceItem => item !== null)
    .filter(item => item.testStage !== stage);

  const nextBatch = incoming.map(item => ({ ...item, testStage: stage }));
  const merged = [...kept, ...nextBatch];

  merged.sort((a, b) => {
    const order = STAGE_SORT_ORDER[a.testStage] - STAGE_SORT_ORDER[b.testStage];
    if (order !== 0) return order;
    return String(a.testedAt).localeCompare(String(b.testedAt));
  });

  return merged;
}

export function formatPercentMetric(rate: number | null): string {
  if (rate === null) return "暂无数据";
  return `${Math.round(rate * 100)}%`;
}

export function formatCountMetric(value: number | null): string {
  if (value === null) return "暂无数据";
  return String(value);
}

export function formatRankMetric(rank: number | null): string {
  if (rank === null) return "暂无数据";
  return String(Math.round(rank * 10) / 10);
}

export function formatDeltaPercent(delta: number | null): string {
  if (delta === null) return "暂无数据";
  const points = Math.round(delta * 100);
  if (points > 0) return `+${points}%`;
  if (points < 0) return `${points}%`;
  return "0%";
}

export function formatDeltaCount(delta: number | null): string {
  if (delta === null) return "暂无数据";
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return String(delta);
  return "0";
}

export function formatDeltaRank(delta: number | null): string {
  if (delta === null) return "暂无数据";
  const rounded = Math.round(delta * 10) / 10;
  if (rounded > 0) return `+${rounded}`;
  if (rounded < 0) return String(rounded);
  return "0";
}

function computeStageMetrics(items: AiTestEvidenceItem[], stage: AiTestStage): AiTestStageMetrics {
  const stageItems = items.filter(item => item.testStage === stage);
  if (stageItems.length === 0) {
    return {
      hasData: false,
      questionCount: 0,
      mentionRate: null,
      recommendRate: null,
      averageRank: null,
      citedUrlCount: null,
    };
  }

  const mentionCount = stageItems.filter(i => i.mentionedBrand).length;
  const recommendCount = stageItems.filter(i => i.recommendedBrand).length;
  const ranks = stageItems.map(i => i.brandRank).filter((r): r is number => typeof r === "number");
  const citedUrlSet = new Set<string>();
  for (const item of stageItems) {
    for (const url of item.citedUrls) citedUrlSet.add(url);
  }

  return {
    hasData: true,
    questionCount: stageItems.length,
    mentionRate: mentionCount / stageItems.length,
    recommendRate: recommendCount / stageItems.length,
    averageRank: ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null,
    citedUrlCount: citedUrlSet.size,
  };
}

export function buildPublishBeforeAfterCompare(items: AiTestEvidenceItem[]): AiTestPublishCompare {
  const before = computeStageMetrics(items, "before_publish");
  const after = computeStageMetrics(items, "after_publish");

  const delta = (afterVal: number | null, beforeVal: number | null) =>
    afterVal !== null && beforeVal !== null ? afterVal - beforeVal : null;

  return {
    before,
    after,
    changes: {
      mentionRateDelta: delta(after.mentionRate, before.mentionRate),
      recommendRateDelta: delta(after.recommendRate, before.recommendRate),
      averageRankDelta: delta(after.averageRank, before.averageRank),
      citedUrlCountDelta:
        after.citedUrlCount !== null && before.citedUrlCount !== null
          ? after.citedUrlCount - before.citedUrlCount
          : null,
    },
    hasAnyStageData: before.hasData || after.hasData,
  };
}

export function normalizeAiTestResult(raw: unknown): AiTestEvidenceItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const answer = String(r.rawAnswer ?? r.answer ?? "").trim();
  if (!answer && !r.question) return null;

  const mentionsBrand = Boolean(r.mentionedBrand ?? r.mentionsBrand);
  const recommendsBrand = Boolean(r.recommendedBrand ?? r.recommendsBrand);
  const recommendationRank =
    typeof r.brandRank === "number"
      ? r.brandRank
      : typeof r.recommendationRank === "number"
        ? r.recommendationRank
        : null;

  const citedUrls = Array.isArray(r.citedUrls)
    ? r.citedUrls.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    : [];

  const competitorMentions = Array.isArray(r.competitorMentions)
    ? (r.competitorMentions as AiTestCompetitorMention[]).filter(c => typeof c?.name === "string")
    : [];

  const sentimentRaw = r.sentiment;
  const sentiment: AiTestSentiment =
    sentimentRaw === "positive" || sentimentRaw === "negative" || sentimentRaw === "neutral"
      ? sentimentRaw
      : mentionsBrand
        ? "neutral"
        : "neutral";

  const parseStatusRaw = r.parseStatus;
  const parseStatus: AiTestParseStatus =
    parseStatusRaw === "success" || parseStatusRaw === "partial" || parseStatusRaw === "failed"
      ? parseStatusRaw
      : "success";

  return {
    engine: String(r.engine ?? "unknown"),
    engineName: String(r.engineName ?? r.engine ?? "未知引擎"),
    question: String(r.question ?? ""),
    testedAt: String(r.testedAt ?? new Date().toISOString()),
    answer,
    mentionsBrand,
    recommendsBrand,
    recommendationRank,
    rawAnswer: answer,
    mentionedBrand: mentionsBrand,
    recommendedBrand: recommendsBrand,
    brandRank: recommendationRank,
    citedUrls,
    sentiment,
    competitorMentions,
    evidenceSummary: typeof r.evidenceSummary === "string" ? r.evidenceSummary : undefined,
    parseStatus,
    parseError: typeof r.parseError === "string" ? r.parseError : null,
    testStage: resolveTestStage(r),
  };
}

function dominantSentiment(items: AiTestEvidenceItem[]): AiTestSentiment {
  const counts = { positive: 0, neutral: 0, negative: 0 };
  for (const item of items) counts[item.sentiment] += 1;
  if (counts.positive >= counts.negative && counts.positive >= counts.neutral) return "positive";
  if (counts.negative > counts.positive) return "negative";
  return "neutral";
}

export function aggregateAiTestEvidence(
  rows: Array<{ monitoringRecordId: number; results: unknown[] }>,
): AiTestEvidenceAggregate & { items: AiTestEvidenceItem[] } {
  const items: Array<AiTestEvidenceItem & { monitoringRecordId: number; resultIndex: number }> = [];

  for (const row of rows) {
    row.results.forEach((raw, resultIndex) => {
      const normalized = normalizeAiTestResult(raw);
      if (!normalized) return;
      items.push({ ...normalized, monitoringRecordId: row.monitoringRecordId, resultIndex });
    });
  }

  const total = items.length;
  const mentionCount = items.filter(i => i.mentionedBrand).length;
  const recommendCount = items.filter(i => i.recommendedBrand).length;
  const ranks = items.map(i => i.brandRank).filter((r): r is number => typeof r === "number");
  const engineNames = Array.from(new Set(items.map(i => i.engineName)));

  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  for (const item of items) sentimentCounts[item.sentiment] += 1;

  let competitorMentionCount = 0;
  const citedUrlSet = new Set<string>();
  for (const item of items) {
    competitorMentionCount += item.competitorMentions.filter(c => c.mentioned).length;
    for (const url of item.citedUrls) citedUrlSet.add(url);
  }

  const byEngine = engineNames.map(engineName => {
    const engineItems = items.filter(i => i.engineName === engineName);
    const eq = engineItems.length;
    const lastTestedAt = engineItems.map(i => i.testedAt).sort().at(-1) ?? null;
    return {
      engineName,
      questionCount: eq,
      mentionRate: eq > 0 ? engineItems.filter(i => i.mentionedBrand).length / eq : 0,
      recommendRate: eq > 0 ? engineItems.filter(i => i.recommendedBrand).length / eq : 0,
      dominantSentiment: dominantSentiment(engineItems),
      lastTestedAt,
    };
  });

  const sortedSamples = [...items].sort((a, b) => {
    const score = (x: AiTestEvidenceItem) =>
      (x.recommendedBrand ? 4 : 0) + (x.mentionedBrand ? 2 : 0) + (x.sentiment === "positive" ? 1 : 0);
    return score(b) - score(a);
  });

  const keySamples = sortedSamples.slice(0, 5).map(s => ({
    monitoringRecordId: s.monitoringRecordId,
    resultIndex: s.resultIndex,
    engineName: s.engineName,
    question: s.question,
    mentionedBrand: s.mentionedBrand,
    recommendedBrand: s.recommendedBrand,
    sentiment: s.sentiment,
  }));

  return {
    items,
    questionCount: total,
    engineCount: engineNames.length,
    mentionRate: total > 0 ? mentionCount / total : 0,
    recommendRate: total > 0 ? recommendCount / total : 0,
    averageRank: ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null,
    sentimentCounts,
    competitorMentionCount,
    citedUrlCount: citedUrlSet.size,
    byEngine,
    keySamples,
    publishCompare: buildPublishBeforeAfterCompare(items),
  };
}
