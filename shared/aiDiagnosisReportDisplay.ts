/** AI 实测页「AI 当前怎么看你」业务报告：首屏结论与建议文案 */

import {
  T0_AI_ENGINE_OPTIONS,
  T0_DIAGNOSIS_PLATFORM_ORDER,
  normalizeT0Platform,
} from "./t0DiagnosisDisplay";
import type { AiPlatformPerformanceStatus } from "./aiPlatformPerformance";

export type AiDiagnosisFirstScreenState = "before" | "running" | "completed";

export const AI_DIAGNOSIS_PAGE_TITLE = "AI 现状诊断";
export const AI_DIAGNOSIS_PAGE_SUBTITLE =
  "检测主流 AI 平台是否认识、提到并推荐你的品牌。";

export const AI_DIAGNOSIS_RUNNING_BACKGROUND_HINT =
  "你无需停留在本页等待，可以先继续执行本月优化任务。检测完成后，这里会自动生成 AI 现状诊断报告。";

export const AI_DIAGNOSIS_RUNNING_PATIENCE_HINT =
  "部分平台响应较慢，系统会持续检测并自动更新结果。";

export const AI_DIAGNOSIS_METRIC_EXPLANATIONS = {
  mentionRate: "AI 回答中主动提到你品牌的比例。",
  recommendRate: "AI 在推荐场景中把你作为建议选项的比例。",
  competitorRate: "AI 回答中出现竞品的比例，比例越高说明竞品在 AI 认知中占位越强。",
  coveredQuestions: "本次检测覆盖的客户真实问题数量。",
  coveredPlatforms: "本次参与实测的主流 AI 平台数量。",
} as const;

export type AiDiagnosisRunningProgress = {
  percent: number | null;
  completedPlatforms: number;
  totalPlatforms: number;
  completedQuestions: number;
  totalQuestions: number;
};

export type AiDiagnosisPlatformRunningStatus =
  | "未开始"
  | "检测中"
  | "已完成"
  | "检测失败"
  | "暂未检测";

export type AiDiagnosisPlatformCustomerStatus =
  | "表现较好"
  | "已识别但推荐不足"
  | "未明显识别"
  | "检测失败"
  | "暂未检测";

const TEST_ROUND_PHASE_LABELS: Record<string, string> = {
  T0_BASELINE: "优化前检测",
  T1_RETEST: "发布后 7 天复测",
  T2_RETEST: "发布后 14 天复测",
  T3_RETEST: "发布后 30 天复测",
};

export function resolveTestRoundPhaseLabel(roundType: string | null | undefined): string {
  if (!roundType) return "优化前检测";
  return TEST_ROUND_PHASE_LABELS[roundType] ?? "AI 现状检测";
}

export function mapPlatformPerformanceToCustomerStatus(
  status: AiPlatformPerformanceStatus,
  roundFailed?: boolean,
): AiDiagnosisPlatformCustomerStatus {
  if (roundFailed && status === "未实测") return "检测失败";
  switch (status) {
    case "已推荐":
      return "表现较好";
    case "已提及，推荐不足":
    case "竞品占优":
      return "已识别但推荐不足";
    case "未覆盖":
      return "未明显识别";
    case "未实测":
      return "暂未检测";
    default:
      return "暂未检测";
  }
}

export function computeAiDiagnosisRunningProgress(input: {
  runs: Array<{ questionId: number; platform: string }>;
  totalQuestions: number;
  runsPerQuestion: number;
  activePlatformIds: string[];
}): AiDiagnosisRunningProgress {
  const totalPlatforms = T0_DIAGNOSIS_PLATFORM_ORDER.length;
  const safeTotalQuestions = Math.max(1, input.totalQuestions);
  const runsPerPlatformPerQuestion = Math.max(1, input.runsPerQuestion);
  const activeSet = new Set(input.activePlatformIds.map(normalizeT0Platform));

  let completedPlatforms = 0;
  for (const platformId of T0_DIAGNOSIS_PLATFORM_ORDER) {
    if (!activeSet.has(platformId)) continue;
    const platformRuns = input.runs.filter(run => normalizeT0Platform(run.platform) === platformId);
    const runsByQuestion = new Map<number, number>();
    for (const run of platformRuns) {
      runsByQuestion.set(run.questionId, (runsByQuestion.get(run.questionId) ?? 0) + 1);
    }
    const questionIds = Array.from(runsByQuestion.keys());
    const platformComplete =
      platformRuns.length > 0 &&
      questionIds.length >= safeTotalQuestions &&
      questionIds.every(qid => (runsByQuestion.get(qid) ?? 0) >= runsPerPlatformPerQuestion);
    if (platformComplete) completedPlatforms += 1;
  }

  const expectedRunsPerQuestion = runsPerPlatformPerQuestion * input.activePlatformIds.length;
  const runsByQuestion = new Map<number, number>();
  for (const run of input.runs) {
    runsByQuestion.set(run.questionId, (runsByQuestion.get(run.questionId) ?? 0) + 1);
  }
  let completedQuestions = 0;
  for (const count of runsByQuestion.values()) {
    if (count >= expectedRunsPerQuestion) completedQuestions += 1;
  }

  const platformRatio = totalPlatforms > 0 ? completedPlatforms / totalPlatforms : 0;
  const questionRatio = safeTotalQuestions > 0 ? completedQuestions / safeTotalQuestions : 0;
  const percent =
    input.runs.length > 0 ? Math.min(99, Math.round(((platformRatio + questionRatio) / 2) * 100)) : null;

  return {
    percent,
    completedPlatforms,
    totalPlatforms,
    completedQuestions,
    totalQuestions: safeTotalQuestions,
  };
}

export function resolvePlatformRunningStatuses(input: {
  runs: Array<{ platform: string; questionId: number }>;
  totalQuestions: number;
  runsPerQuestion: number;
  activePlatformIds: string[];
  roundFailed: boolean;
}): Array<{ platformId: string; platformName: string; status: AiDiagnosisPlatformRunningStatus }> {
  const labelById = new Map(T0_AI_ENGINE_OPTIONS.map(option => [option.id, option.label]));
  const activeSet = new Set(input.activePlatformIds.map(normalizeT0Platform));
  const runsPerPlatformPerQuestion = Math.max(1, input.runsPerQuestion);
  const safeTotalQuestions = Math.max(1, input.totalQuestions);

  return T0_DIAGNOSIS_PLATFORM_ORDER.map(platformId => {
    const platformName = labelById.get(platformId as (typeof T0_AI_ENGINE_OPTIONS)[number]["id"]) ?? platformId;
    if (!activeSet.has(platformId)) {
      return { platformId, platformName, status: "暂未检测" as const };
    }
    const platformRuns = input.runs.filter(run => normalizeT0Platform(run.platform) === platformId);
    if (platformRuns.length === 0) {
      return {
        platformId,
        platformName,
        status: input.roundFailed ? ("检测失败" as const) : ("未开始" as const),
      };
    }
    const runsByQuestion = new Map<number, number>();
    for (const run of platformRuns) {
      runsByQuestion.set(run.questionId, (runsByQuestion.get(run.questionId) ?? 0) + 1);
    }
    const questionIds = Array.from(runsByQuestion.keys());
    const allQuestionsDone =
      questionIds.length >= safeTotalQuestions &&
      questionIds.every(qid => (runsByQuestion.get(qid) ?? 0) >= runsPerPlatformPerQuestion);
    if (allQuestionsDone) {
      return { platformId, platformName, status: "已完成" as const };
    }
    if (input.roundFailed && platformRuns.length > 0 && !allQuestionsDone) {
      return { platformId, platformName, status: "检测失败" as const };
    }
    return { platformId, platformName, status: "检测中" as const };
  });
}

export type AiRecognitionStatus = "是" | "否" | "部分认识";
export type AiRecommendStatus = "是" | "否" | "偶尔";

export function isActiveT0TestRoundStatus(status: string | null | undefined): boolean {
  return status === "running" || status === "pending";
}

export function resolveAiDiagnosisFirstScreenState(input: {
  isT0Running: boolean;
  t0Starting: boolean;
  hasT0BaselineResult: boolean;
  hasAiTestMetrics: boolean;
  /** 当前展示轮次的 test_rounds.status；pending 与 running 同等视为检测中 */
  t0RoundStatus?: string | null;
}): AiDiagnosisFirstScreenState {
  if (
    input.isT0Running ||
    input.t0Starting ||
    isActiveT0TestRoundStatus(input.t0RoundStatus)
  ) {
    return "running";
  }
  if (input.hasT0BaselineResult && input.hasAiTestMetrics) return "completed";
  return "before";
}

export function resolveAiRecognitionStatus(mentionPct: number | null): AiRecognitionStatus {
  if (mentionPct == null) return "否";
  if (mentionPct === 0) return "否";
  if (mentionPct > 50) return "是";
  return "部分认识";
}

export function resolveAiRecommendStatus(recommendPct: number | null): AiRecommendStatus {
  if (recommendPct == null) return "否";
  if (recommendPct === 0) return "否";
  if (recommendPct > 20) return "是";
  return "偶尔";
}

export function buildAiDiagnosisReportConclusion(
  mentionPct: number | null,
  recommendPct: number | null,
): string {
  const mention = mentionPct ?? 0;
  const recommend = recommendPct ?? 0;
  if (mention > 50 && recommend > 20) {
    return "当前 AI 已能识别你的品牌，并在推荐场景中稳定出现，建议继续扩大覆盖面。";
  }
  if (mention > 50 && recommend <= 20) {
    return "当前 AI 已能识别你的品牌，但推荐意愿偏弱，建议补充产品能力、客户案例和对比说明。";
  }
  if (mention > 20) {
    return "当前 AI 对你的品牌有一定认知，但缺少足够可信信源支撑推荐。";
  }
  return "当前 AI 对你的品牌认知不足，推荐场景中更容易出现竞品。";
}

export function buildAiDiagnosisReportActionSuggestions(
  mentionPct: number | null,
  recommendPct: number | null,
): string[] {
  const mention = mentionPct ?? 0;
  const recommend = recommendPct ?? 0;
  const suggestions: string[] = [];

  if (mention <= 50) {
    suggestions.push("优先完善品牌基础资料与公开信源，提升 AI 对品牌的识别稳定性。");
  }
  if (mention > 50 && recommend <= 20) {
    suggestions.push("补充客户案例、信任证据与竞品对比内容，强化 AI 推荐理由。");
  }
  if (mention > 50 && recommend > 20) {
    suggestions.push("围绕尚未覆盖的高意向问题扩展内容，继续提升提及与推荐覆盖面。");
  }
  if (suggestions.length === 0) {
    suggestions.push("按本月优化计划推进内容补齐，7–14 天后复测验证成效。");
  }
  if (suggestions.length === 1 && mention <= 50 && recommend <= 20) {
    suggestions.push("启用问题池中的行业推荐类问题，针对性产出可引用内容。");
  }
  return suggestions.slice(0, 2);
}
