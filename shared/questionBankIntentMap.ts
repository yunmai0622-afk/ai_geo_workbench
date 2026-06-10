import { T0_QUESTION_GAP_TAGS, type T0QuestionGapTagLabel } from "./t0QuestionGapTags";

export const QUESTION_INTENT_GROUPS = [
  { key: "brand_awareness", label: "品牌认知", defaultOpen: true },
  { key: "scenario_pain", label: "场景痛点", defaultOpen: true },
  { key: "solution_seeking", label: "方案寻找", defaultOpen: true },
  { key: "competitor_compare", label: "竞品比较", defaultOpen: false },
  { key: "purchase_decision", label: "购买决策", defaultOpen: false },
  { key: "industry_trend", label: "行业趋势", defaultOpen: false },
] as const;

export type QuestionIntentGroupKey = (typeof QUESTION_INTENT_GROUPS)[number]["key"];

export type QuestionPriorityLevel = "高" | "中" | "低";

export type QuestionTestStatus = "未测" | "已测" | "发现缺口" | "已覆盖";

export type QuestionContentStatus = "未生成" | "已生成" | "已发布" | "待复测";

export type QuestionSourceLabel = "AI 生成" | "人工添加" | "AI 诊断发现";

export type QuestionBankRow = {
  id: number;
  questionText: string;
  questionType: string;
  targetKeyword?: string | null;
  intentLevel?: string | null;
  businessValue?: number | null;
  source?: string | null;
  enabled: number | boolean | null;
  contentGapTags?: string[] | null;
};

export type QuestionArticleLink = {
  status?: string | null;
  generationBasis?: Record<string, unknown> | null;
};

const TARGET_INTENT_TO_GROUP: Record<string, QuestionIntentGroupKey> = {
  痛点问题: "scenario_pain",
  选型问题: "solution_seeking",
  竞品对比: "competitor_compare",
  "价格与ROI": "purchase_decision",
  落地执行: "purchase_decision",
  风险顾虑: "purchase_decision",
};

const QUESTION_TYPE_TO_GROUP: Record<string, QuestionIntentGroupKey> = {
  品牌认知: "brand_awareness",
  scenario_need: "scenario_pain",
  痛点解决: "scenario_pain",
  行业推荐: "solution_seeking",
  竞品对比: "competitor_compare",
  long_tail_conversion: "purchase_decision",
  价格选型: "purchase_decision",
  高意向成交: "purchase_decision",
};

export function parseQuestionTargetIntent(targetKeyword?: string | null): string {
  const raw = typeof targetKeyword === "string" ? targetKeyword.trim() : "";
  if (!raw.startsWith("{")) return "";
  try {
    const parsed = JSON.parse(raw) as { intent?: unknown };
    return typeof parsed.intent === "string" ? parsed.intent.trim() : "";
  } catch {
    return "";
  }
}

export function resolveQuestionIntentGroupKey(question: QuestionBankRow): QuestionIntentGroupKey | null {
  const targetIntent = parseQuestionTargetIntent(question.targetKeyword);
  if (targetIntent && TARGET_INTENT_TO_GROUP[targetIntent]) {
    return TARGET_INTENT_TO_GROUP[targetIntent];
  }
  const byType = QUESTION_TYPE_TO_GROUP[question.questionType];
  if (byType) return byType;
  if (question.questionType === "指定问题" && targetIntent) {
    return "solution_seeking";
  }
  return null;
}

export function resolveQuestionIntentLabel(question: QuestionBankRow): string {
  const groupKey = resolveQuestionIntentGroupKey(question);
  if (groupKey) {
    return QUESTION_INTENT_GROUPS.find(group => group.key === groupKey)?.label ?? "待分类";
  }
  return "待分类";
}

export function questionGapTags(question: QuestionBankRow): T0QuestionGapTagLabel[] {
  if (!Array.isArray(question.contentGapTags)) return [];
  return question.contentGapTags.filter(
    (tag): tag is T0QuestionGapTagLabel =>
      tag === T0_QUESTION_GAP_TAGS.highPriorityGap ||
      tag === T0_QUESTION_GAP_TAGS.competitorSuppression ||
      tag === T0_QUESTION_GAP_TAGS.lowRecommendRate,
  );
}

export function questionPriorityRank(question: QuestionBankRow): number {
  const tags = questionGapTags(question);
  if (tags.includes(T0_QUESTION_GAP_TAGS.highPriorityGap)) return 0;
  if (tags.includes(T0_QUESTION_GAP_TAGS.competitorSuppression)) return 1;
  if (tags.includes(T0_QUESTION_GAP_TAGS.lowRecommendRate)) return 2;
  if (question.intentLevel === "高") return 3;
  if ((question.businessValue ?? 0) >= 4) return 4;
  if (question.intentLevel === "中") return 5;
  return 6;
}

export function resolveQuestionPriorityLevel(question: QuestionBankRow): QuestionPriorityLevel {
  const rank = questionPriorityRank(question);
  if (rank <= 1) return "高";
  if (rank <= 4) return "中";
  return "低";
}

export function resolveQuestionSourceLabel(question: QuestionBankRow): QuestionSourceLabel {
  if (question.source === "manual" || question.source === "csv") return "人工添加";
  if (questionGapTags(question).length > 0 && question.source === "ai_generated") {
    return "AI 诊断发现";
  }
  return "AI 生成";
}

export function resolveQuestionTestStatus(
  question: QuestionBankRow,
  testedQuestionIds: ReadonlySet<number>,
  hasCompletedT0Baseline: boolean,
): QuestionTestStatus {
  const tags = questionGapTags(question);
  if (tags.length > 0) return "发现缺口";
  if (hasCompletedT0Baseline && testedQuestionIds.has(question.id)) return "已覆盖";
  if (testedQuestionIds.has(question.id)) return "已测";
  return "未测";
}

export function resolveQuestionTestStatusHint(status: QuestionTestStatus): string | null {
  if (status !== "未测") return null;
  return "尚未实测。完成 AI 基线检测后，将展示该问题在豆包、Kimi、DeepSeek 等平台中的品牌提及和推荐情况。";
}

export function resolveQuestionContentStatus(
  question: QuestionBankRow,
  articles: QuestionArticleLink[],
): QuestionContentStatus {
  const normalizedQuestion = question.questionText.trim();
  const linked = articles.filter(article => {
    const customerQuestion =
      typeof article.generationBasis?.customerQuestion === "string"
        ? article.generationBasis.customerQuestion.trim()
        : "";
    return customerQuestion.length > 0 && customerQuestion === normalizedQuestion;
  });
  if (linked.length === 0) return "未生成";
  if (linked.some(article => article.status === "已发布")) return "已发布";
  if (linked.some(article => article.status === "待复测")) return "待复测";
  return "已生成";
}

export function resolveQuestionContentStatusHint(status: QuestionContentStatus): string | null {
  if (status !== "未生成") return null;
  return "尚未生成内容。发现 GEO 缺口后，可围绕该问题生成平台化内容。";
}

export function countQuestionsMissingIntent(questions: QuestionBankRow[]): number {
  return questions.filter(question => resolveQuestionIntentGroupKey(question) == null).length;
}

export function groupQuestionsByIntent(questions: QuestionBankRow[]) {
  const grouped = Object.fromEntries(
    QUESTION_INTENT_GROUPS.map(group => [group.key, [] as QuestionBankRow[]]),
  ) as Record<QuestionIntentGroupKey, QuestionBankRow[]>;
  const unclassified: QuestionBankRow[] = [];

  for (const question of questions) {
    const key = resolveQuestionIntentGroupKey(question);
    if (key) grouped[key].push(question);
    else unclassified.push(question);
  }

  for (const key of Object.keys(grouped) as QuestionIntentGroupKey[]) {
    grouped[key].sort((a, b) => {
      const rankDiff = questionPriorityRank(a) - questionPriorityRank(b);
      if (rankDiff !== 0) return rankDiff;
      return a.id - b.id;
    });
  }

  unclassified.sort((a, b) => questionPriorityRank(a) - questionPriorityRank(b) || a.id - b.id);

  return { grouped, unclassified };
}

export type QuestionIntentGroupStats = {
  total: number;
  enabled: number;
  tested: number;
  gapCount: number;
  contentReadyCount: number;
};

export function buildQuestionIntentGroupStats(input: {
  questions: QuestionBankRow[];
  testedQuestionIds: ReadonlySet<number>;
  hasCompletedT0Baseline: boolean;
  articles: QuestionArticleLink[];
}): Record<QuestionIntentGroupKey, QuestionIntentGroupStats> {
  const stats = Object.fromEntries(
    QUESTION_INTENT_GROUPS.map(group => [
      group.key,
      { total: 0, enabled: 0, tested: 0, gapCount: 0, contentReadyCount: 0 },
    ]),
  ) as Record<QuestionIntentGroupKey, QuestionIntentGroupStats>;

  for (const question of input.questions) {
    const key = resolveQuestionIntentGroupKey(question);
    if (!key) continue;
    const bucket = stats[key];
    bucket.total += 1;
    if (Number(question.enabled) !== 0) bucket.enabled += 1;
    if (input.testedQuestionIds.has(question.id)) bucket.tested += 1;
    if (questionGapTags(question).length > 0) bucket.gapCount += 1;
    const contentStatus = resolveQuestionContentStatus(question, input.articles);
    if (contentStatus !== "未生成") bucket.contentReadyCount += 1;
  }

  return stats;
}

export type QuestionBankOverviewMetrics = {
  total: number;
  enabledCount: number;
  currentRoundQuestionCount: number;
  gapCount: number;
  contentTaskCount: number;
  hasCompletedT0Baseline: boolean;
};

export function buildQuestionBankOverviewMetrics(input: {
  questions: QuestionBankRow[];
  currentRoundQuestionCount: number;
  contentTaskCount: number;
  hasCompletedT0Baseline: boolean;
}): QuestionBankOverviewMetrics {
  const gapCount = input.questions.reduce(
    (sum, question) => sum + (questionGapTags(question).length > 0 ? 1 : 0),
    0,
  );
  return {
    total: input.questions.length,
    enabledCount: input.questions.filter(question => Number(question.enabled) !== 0).length,
    currentRoundQuestionCount: input.currentRoundQuestionCount,
    gapCount,
    contentTaskCount: input.contentTaskCount,
    hasCompletedT0Baseline: input.hasCompletedT0Baseline,
  };
}

export type TestRoundSummary = {
  id: string;
  roundType: string;
  roundName: string;
  status: string;
  questionsCount: number;
  intentLabels: string[];
};

export function resolveTestRoundDisplayName(round: Pick<TestRoundSummary, "roundType" | "roundName">): string {
  if (round.roundType === "T0_BASELINE") return "AI 现状检测";
  if (round.roundType === "T1_RETEST") return "7天后复测";
  if (round.roundType === "T2_RETEST" || round.roundType === "T3_RETEST") {
    return round.roundName.trim() || "复测题组";
  }
  return round.roundName.trim() || "手动题组";
}

export function resolveTestRoundStatusLabel(status: string): "待检测" | "检测中" | "已完成" {
  if (status === "running") return "检测中";
  if (status === "completed") return "已完成";
  return "待检测";
}

export function buildQuestionBankAssistantBlockers(input: {
  hasCurrentRound: boolean;
  missingIntentCount: number;
}): string[] {
  const blockers: string[] = [];
  if (!input.hasCurrentRound) {
    blockers.push("尚未创建本轮实测题组");
  }
  if (input.missingIntentCount > 0) {
    blockers.push(`仍有 ${input.missingIntentCount} 个问题缺少意图分类`);
  }
  return blockers;
}

export function resolveQuestionNextAction(input: {
  question: QuestionBankRow;
  testedQuestionIds: ReadonlySet<number>;
  hasCompletedT0Baseline: boolean;
  articles: QuestionArticleLink[];
}): string {
  const enabled = Number(input.question.enabled) !== 0;
  if (!enabled) return "启用问题";
  const testStatus = resolveQuestionTestStatus(
    input.question,
    input.testedQuestionIds,
    input.hasCompletedT0Baseline,
  );
  const contentStatus = resolveQuestionContentStatus(input.question, input.articles);
  if (testStatus === "发现缺口" && contentStatus === "未生成") return "围绕缺口生成内容";
  if (testStatus === "未测") return "去 AI 实测诊断";
  if (contentStatus === "未生成") return "生成平台化内容";
  if (contentStatus === "已生成") return "进入发布流程";
  if (contentStatus === "待复测") return "安排复测";
  if (contentStatus === "已发布") return "查看发布效果";
  return "查看实测结果";
}

export function resolveQuestionBankAssistantNextAction(input: {
  totalQuestions: number;
  enabledCount: number;
  hasCurrentRound: boolean;
  roundStatus?: string | null;
  hasCompletedT0Baseline: boolean;
  gapCount: number;
}): string {
  if (input.totalQuestions === 0) return "生成或手动添加高价值问题";
  if (input.enabledCount === 0) return "启用 5-10 个高价值问题";
  if (!input.hasCurrentRound) return "创建本轮实测题组";
  if (input.roundStatus === "running") return "查看 AI 实测进度";
  if (!input.hasCompletedT0Baseline) return "完成 AI 现状检测";
  if (input.gapCount > 0) return "围绕缺口生成内容任务";
  return "查看实测结果并规划内容";
}

export const QUESTION_BANK_ASSISTANT_SUGGESTIONS = [
  "优先选择 5-10 个高价值问题建立优化前基线",
  "覆盖品牌认知、场景痛点、方案寻找三类问题",
  "不要一次性启用所有低价值问题",
] as const;

export const QUESTION_QUALITY_STANDARDS = [
  "目标客户真实会向 AI 提问",
  "有明确业务场景",
  "有潜在购买或咨询意图",
  "能自然引出企业产品或服务",
  "不是空泛百科问题",
  "不是纯 SEO 标题",
  "不是企业自嗨式问题",
] as const;

export const QUESTION_QUALITY_INTENT_COVERAGE = QUESTION_INTENT_GROUPS.map(group => group.label);
