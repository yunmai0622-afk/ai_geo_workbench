import type { WeeklyPlatformKey } from "./articlePublishPlatform";
import { aggregateT0AiTestRunMetrics } from "./t0AiTestRunMetrics";
import { DIAGNOSIS_HIT_QUESTION_TYPES } from "./t0DiagnosisVisualization";
import { resolvePlatformDisplayLabel, resolveQuestionTypeDisplayLabel } from "./retestComparisonDisplay";

export type T0ContentGapRunRow = {
  questionId: number;
  platform: string;
  mentionedCompany: boolean;
  recommendedCompany: boolean;
  competitorMentioned: boolean;
  competitorNames: string[];
};

export type T0ContentGapSuggestion = {
  id: string;
  message: string;
  weeklyPlatform: WeeklyPlatformKey | null;
  questionType: string | null;
  actionPath: string;
};

export type T0ContentGapSuggestionsResult = {
  headline: string;
  /** 单行摘要，供周报/通知复用 */
  summaryLine: string;
  items: T0ContentGapSuggestion[];
  roundId: string;
  dataSource: "ai_test_runs";
};

const QUESTION_TYPE_PUBLISH_PLATFORM: Record<string, WeeklyPlatformKey> = {
  品牌认知: "zhihu",
  行业推荐: "baijiahao",
  竞品对比: "zhihu",
  scenario_need: "xiaohongshu",
  long_tail_conversion: "wechat",
};

const PUBLISH_PLATFORM_LABELS: Record<WeeklyPlatformKey, string> = {
  xiaohongshu: "小红书",
  zhihu: "知乎",
  baijiahao: "百家号",
  toutiao: "头条号",
  sohu: "搜狐号",
  netease: "网易号",
  wechat: "公众号",
  other: "其他平台",
};

const QUESTION_TYPE_CONTENT_LABEL: Record<string, string> = {
  品牌认知: "品牌认知",
  行业推荐: "行业推荐",
  竞品对比: "竞品对比",
  scenario_need: "场景需求",
  long_tail_conversion: "长尾转化",
};

function normalizePlatform(platform: string): string {
  const key = platform.trim().toLowerCase();
  if (key === "豆包") return "doubao";
  if (key === "通义" || key === "通义千问") return "qwen";
  if (key === "文心" || key === "文心一言") return "wenxin";
  return key;
}

function runsForQuestionType(
  runs: T0ContentGapRunRow[],
  questionTypeByQuestionId: Map<number, string>,
  questionType: string,
): T0ContentGapRunRow[] {
  return runs.filter(run => questionTypeByQuestionId.get(run.questionId) === questionType);
}

function mentionRate(runs: T0ContentGapRunRow[]): number {
  const metrics = aggregateT0AiTestRunMetrics(runs);
  return metrics?.mentionRate ?? 0;
}

function resolvePublishPlatformLabel(key: WeeklyPlatformKey): string {
  return PUBLISH_PLATFORM_LABELS[key] ?? key;
}

function resolveQuestionTypeContentLabel(questionType: string): string {
  return QUESTION_TYPE_CONTENT_LABEL[questionType] ?? questionType;
}

export function buildT0ContentProductionPath(input: {
  weeklyPlatform?: WeeklyPlatformKey | null;
  questionType?: string | null;
}): string {
  const params = new URLSearchParams();
  if (input.weeklyPlatform) params.set("weeklyPlatform", input.weeklyPlatform);
  if (input.questionType) params.set("questionType", input.questionType);
  const qs = params.toString();
  return qs ? `/weekly?${qs}` : "/weekly";
}

function pickDominantQuestionTypeForPlatform(
  runs: T0ContentGapRunRow[],
  questionTypeByQuestionId: Map<number, string>,
): string {
  const counts = new Map<string, number>();
  for (const run of runs) {
    const questionType = questionTypeByQuestionId.get(run.questionId);
    if (!questionType || run.mentionedCompany) continue;
    counts.set(questionType, (counts.get(questionType) ?? 0) + 1);
  }
  let bestType = "行业推荐";
  let bestCount = 0;
  for (const [type, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestType = type;
    }
  }
  return bestType;
}

function pickTopCompetitorGap(
  runs: T0ContentGapRunRow[],
  questionTypeByQuestionId: Map<number, string>,
): { competitorName: string; questionType: string } | null {
  const gapRuns = runs.filter(run => run.competitorMentioned && !run.mentionedCompany);
  if (gapRuns.length === 0) return null;

  const byType = new Map<string, { competitorCounts: Map<string, number>; total: number }>();
  for (const run of gapRuns) {
    const questionType = questionTypeByQuestionId.get(run.questionId);
    if (!questionType) continue;
    const bucket = byType.get(questionType) ?? { competitorCounts: new Map(), total: 0 };
    bucket.total += 1;
    for (const name of run.competitorNames) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      bucket.competitorCounts.set(trimmed, (bucket.competitorCounts.get(trimmed) ?? 0) + 1);
    }
    byType.set(questionType, bucket);
  }

  let bestType: string | null = null;
  let bestTypeTotal = 0;
  for (const [type, bucket] of byType) {
    if (bucket.total > bestTypeTotal) {
      bestTypeTotal = bucket.total;
      bestType = type;
    }
  }
  if (!bestType) return null;

  const bucket = byType.get(bestType)!;
  let competitorName = "";
  let bestMentions = 0;
  for (const [name, count] of bucket.competitorCounts) {
    if (count > bestMentions) {
      bestMentions = count;
      competitorName = name;
    }
  }
  if (!competitorName) return null;

  return { competitorName, questionType: bestType };
}

/** T0 完成后基于 ai_test_runs 生成内容缺口建议（最多 3 条）。 */
export function buildT0ContentGapSuggestions(
  runs: T0ContentGapRunRow[],
  questionTypeByQuestionId: Map<number, string>,
  roundId: string,
): T0ContentGapSuggestionsResult | null {
  if (runs.length === 0) return null;

  const questionTypeItems: T0ContentGapSuggestion[] = [];
  const platformItems: T0ContentGapSuggestion[] = [];
  const competitorItems: T0ContentGapSuggestion[] = [];

  for (const typeDef of DIAGNOSIS_HIT_QUESTION_TYPES) {
    const scoped = runsForQuestionType(runs, questionTypeByQuestionId, typeDef.key);
    if (scoped.length === 0 || mentionRate(scoped) > 0) continue;
    const weeklyPlatform = QUESTION_TYPE_PUBLISH_PLATFORM[typeDef.key] ?? "zhihu";
    const publishLabel = resolvePublishPlatformLabel(weeklyPlatform);
    const contentLabel = resolveQuestionTypeContentLabel(typeDef.key);
    questionTypeItems.push({
      id: `question_type_zero_${typeDef.key}`,
      message: `${publishLabel}缺少「${contentLabel}」类内容`,
      weeklyPlatform,
      questionType: typeDef.key,
      actionPath: buildT0ContentProductionPath({ weeklyPlatform, questionType: typeDef.key }),
    });
  }

  const platformPriority = ["deepseek", "doubao", "kimi", "qwen", "wenxin"];
  const platforms = Array.from(new Set(runs.map(run => normalizePlatform(run.platform)))).sort(
    (a, b) => platformPriority.indexOf(a) - platformPriority.indexOf(b),
  );
  for (const platform of platforms) {
    const scoped = runs.filter(run => normalizePlatform(run.platform) === platform);
    if (scoped.length === 0 || mentionRate(scoped) > 0) continue;
    const dominantType = pickDominantQuestionTypeForPlatform(scoped, questionTypeByQuestionId);
    const weeklyPlatform = QUESTION_TYPE_PUBLISH_PLATFORM[dominantType] ?? "zhihu";
    const contentLabel = resolveQuestionTypeContentLabel(dominantType);
    const aiLabel = resolvePlatformDisplayLabel(platform);
    platformItems.push({
      id: `platform_zero_${platform}`,
      message: `${aiLabel}未提及品牌，建议补充${contentLabel}类内容`,
      weeklyPlatform,
      questionType: dominantType,
      actionPath: buildT0ContentProductionPath({ weeklyPlatform, questionType: dominantType }),
    });
  }

  const competitorGap = pickTopCompetitorGap(runs, questionTypeByQuestionId);
  if (competitorGap) {
    const weeklyPlatform = QUESTION_TYPE_PUBLISH_PLATFORM[competitorGap.questionType] ?? "zhihu";
    const typeLabel = resolveQuestionTypeDisplayLabel(competitorGap.questionType).replace(/类问题$/, "");
    competitorItems.push({
      id: `competitor_gap_${competitorGap.questionType}`,
      message: `竞品${competitorGap.competitorName}在${typeLabel}类问题上被频繁引用`,
      weeklyPlatform,
      questionType: competitorGap.questionType,
      actionPath: buildT0ContentProductionPath({
        weeklyPlatform,
        questionType: competitorGap.questionType,
      }),
    });
  }

  const items: T0ContentGapSuggestion[] = [];
  const usedIds = new Set<string>();
  const pushItem = (item: T0ContentGapSuggestion) => {
    if (items.length >= 3 || usedIds.has(item.id)) return;
    usedIds.add(item.id);
    items.push(item);
  };

  for (const bucket of [questionTypeItems, platformItems, competitorItems]) {
    if (bucket[0]) pushItem(bucket[0]);
  }
  for (const bucket of [questionTypeItems, platformItems, competitorItems]) {
    for (const item of bucket) pushItem(item);
  }

  if (items.length === 0) return null;

  const headline = `检测发现${items.length}个内容缺口：`;
  const summaryLine = `${headline} ${items.map(item => item.message).join("；")}`;

  return {
    headline,
    summaryLine,
    items,
    roundId,
    dataSource: "ai_test_runs",
  };
}
