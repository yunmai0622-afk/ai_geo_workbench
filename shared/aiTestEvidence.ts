export type AiTestSentiment = "positive" | "neutral" | "negative";
export type AiTestParseStatus = "success" | "partial" | "failed";
export type AiTestStage = "before_publish" | "after_publish" | "manual_check";
export type ScheduledRetestKey = "light_t2" | "t2" | "t3";

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

export type AiTestMissReason =
  | "fresh_content_delay"
  | "question_too_generic"
  | "weak_brand_entity"
  | "no_retrieval_signal"
  | "unknown";

const AI_TEST_MISS_REASONS: AiTestMissReason[] = [
  "fresh_content_delay",
  "question_too_generic",
  "weak_brand_entity",
  "no_retrieval_signal",
  "unknown",
];

const MISS_REASON_LABELS: Record<AiTestMissReason, string> = {
  fresh_content_delay: "内容刚发布，AI 可能尚未抓取或更新。",
  question_too_generic: "问题较泛，AI 更倾向回答通用方案，不一定会主动推荐具体品牌。",
  weak_brand_entity: "品牌与该场景的关联信号较弱，AI 还没有形成明确认知。",
  no_retrieval_signal: "暂未发现 AI 引用或检索到相关内容。",
  unknown: "暂无法判断，需要持续复测。",
};

const GENERIC_QUESTION_PATTERN =
  /(怎么办|怎么解决|有什么工具|如何管理|有哪些|如何用|怎么处理|有什么方法|如何提升|如何解决|怎么选|哪个好)/;

export function isAiTestMissReason(value: unknown): value is AiTestMissReason {
  return typeof value === "string" && (AI_TEST_MISS_REASONS as string[]).includes(value);
}

export function missReasonLabelCn(reason: AiTestMissReason | undefined | null): string | null {
  if (!reason || !isAiTestMissReason(reason)) return null;
  return MISS_REASON_LABELS[reason];
}

export type InferMissReasonInput = {
  question: string;
  citedUrls: string[];
  testedAt: string;
  articlePublishedAt?: Date | string | null;
  brandNames?: string[];
};

export function inferMissReason(input: InferMissReasonInput): AiTestMissReason {
  const testedAt = new Date(input.testedAt);
  const publishedAtRaw = input.articlePublishedAt;
  if (publishedAtRaw) {
    const publishedAt = publishedAtRaw instanceof Date ? publishedAtRaw : new Date(publishedAtRaw);
    if (!Number.isNaN(publishedAt.getTime()) && !Number.isNaN(testedAt.getTime())) {
      const days = (testedAt.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (days >= 0 && days < 7) return "fresh_content_delay";
    }
  }

  const question = input.question.trim();
  const brandNames = (input.brandNames ?? []).filter(n => n.trim().length >= 2);
  const brandInQuestion = brandNames.some(name => question.includes(name));
  if (GENERIC_QUESTION_PATTERN.test(question) && !brandInQuestion) {
    return "question_too_generic";
  }

  if (input.citedUrls.length === 0) {
    return "no_retrieval_signal";
  }

  return "weak_brand_entity";
}

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
  missReason?: AiTestMissReason;
  /** 样板自动复测节点；用于保留并区分 light_t2 / T2 / T3 证据。 */
  scheduledRetestKey?: ScheduledRetestKey;
  scheduledDueDate?: string;
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

/**
 * 同一自动复测节点可重跑替换，不同节点的真实结果必须保留。
 * legacyLightT2DueDate 仅用于在首次正式 T2 写入时标记历史未分轮次的 07/12 样板结果。
 */
export function mergeScheduledRetestResults(
  existing: unknown[],
  incoming: AiTestEvidenceItem[],
  key: ScheduledRetestKey,
  dueDate: string,
  legacyLightT2DueDate?: string,
): AiTestEvidenceItem[] {
  const normalized = existing
    .map(raw => normalizeAiTestResult(raw))
    .filter((item): item is AiTestEvidenceItem => item !== null)
    .map(item =>
      legacyLightT2DueDate && item.testStage === "manual_check" && !item.scheduledRetestKey
        ? { ...item, scheduledRetestKey: "light_t2" as const, scheduledDueDate: legacyLightT2DueDate }
        : item,
    )
    .filter(item => item.scheduledRetestKey !== key);

  const nextBatch = incoming.map(item => ({
    ...item,
    testStage: "manual_check" as const,
    scheduledRetestKey: key,
    scheduledDueDate: dueDate,
  }));
  return [...normalized, ...nextBatch].sort((a, b) =>
    String(a.testedAt).localeCompare(String(b.testedAt)),
  );
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

  const missReasonRaw = r.missReason;
  const missReason = isAiTestMissReason(missReasonRaw) ? missReasonRaw : undefined;
  const scheduledRetestKeyRaw = r.scheduledRetestKey;
  const scheduledRetestKey =
    scheduledRetestKeyRaw === "light_t2" || scheduledRetestKeyRaw === "t2" || scheduledRetestKeyRaw === "t3"
      ? scheduledRetestKeyRaw
      : undefined;

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
    ...(missReason ? { missReason } : {}),
    ...(scheduledRetestKey ? { scheduledRetestKey } : {}),
    ...(typeof r.scheduledDueDate === "string" ? { scheduledDueDate: r.scheduledDueDate } : {}),
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
