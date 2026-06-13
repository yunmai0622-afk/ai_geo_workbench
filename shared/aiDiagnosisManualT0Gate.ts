export type T0StartConfirmInput = {
  questionCount: number;
  platformCount: number;
  runsPerQuestion?: number;
};

export const T0_LONG_RUNNING_BACKGROUND_THRESHOLD_MINUTES = 10;

export const T0_BACKGROUND_MODE_FOOTER_NOTE =
  "检测任务已创建，系统将在后台持续执行，你可以先去完善建档或生成内容。";

export const T0_COMPLETION_OUTCOMES = [
  "AI 是否提到你的品牌",
  "AI 是否推荐你的品牌",
  "哪些竞品更容易被推荐",
  "当前主要短板",
  "后续内容和信源优化建议",
] as const;

export const AI_DIAGNOSIS_RETEST_STAGE_COPY = [
  { tag: "T0", title: "优化前检测", description: "开始服务前，了解 AI 当前是否推荐你" },
  { tag: "T1", title: "7天后复测", description: "发布内容后观察是否被 AI 识别" },
  { tag: "T2", title: "14天后复测", description: "观察提及率和推荐率变化" },
  { tag: "T3", title: "30天后复测", description: "形成月度趋势和交付报告" },
] as const;

export type T0StartConfirmCopy = {
  title: string;
  intro: string;
  questionCount: number;
  platformCount: number;
  analysisCount: number;
  estimatedMinutes: number;
  footerNote: string;
  confirmLabel: string;
  cancelLabel: string;
  completionOutcomes: readonly string[];
  /** 预计耗时超过阈值时，前台不表现为必须长时间等待 */
  backgroundMode?: boolean;
  estimatedMinutesLabel?: string;
};

export type AiDiagnosisRerunConfirmCopy = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
};

export function formatT0DurationText(estimatedMinutes: number): string {
  if (estimatedMinutes < 60) {
    return `约${estimatedMinutes}分钟`;
  }
  const hours = Math.floor(estimatedMinutes / 60);
  const minutes = estimatedMinutes % 60;
  return `约${hours}小时${minutes}分钟`;
}

export function estimateT0DiagnosisMinutes(input: T0StartConfirmInput): number {
  const questionCount = Math.max(1, input.questionCount);
  const platformCount = Math.max(1, input.platformCount);
  const runsPerQuestion = Math.max(1, input.runsPerQuestion ?? 3);
  const totalCalls = questionCount * platformCount * runsPerQuestion;
  const minutes = Math.ceil((totalCalls * 25) / 60);
  return Math.max(5, Math.min(minutes, 180));
}

export function buildT0StartConfirmCopy(input: T0StartConfirmInput): T0StartConfirmCopy {
  const questionCount = Math.max(0, input.questionCount);
  const platformCount = Math.max(0, input.platformCount);
  const analysisCount = questionCount * platformCount;
  const estimatedMinutes = estimateT0DiagnosisMinutes(input);
  const backgroundMode = estimatedMinutes > T0_LONG_RUNNING_BACKGROUND_THRESHOLD_MINUTES;

  return {
    title: "开始 AI 推荐现状检测？",
    intro:
      "系统会用当前问题池测试主流 AI 平台，了解 AI 现在是否认识、提到并推荐你的品牌。本次结果会作为优化前的基线，后续可与发布内容后的复测结果对比。",
    questionCount,
    platformCount,
    analysisCount,
    estimatedMinutes,
    footerNote: backgroundMode
      ? ""
      : `预计${formatT0DurationText(estimatedMinutes)}完成，请保持页面打开。`,
    confirmLabel: "创建 AI 现状检测任务",
    cancelLabel: "取消",
    completionOutcomes: T0_COMPLETION_OUTCOMES,
    backgroundMode,
    estimatedMinutesLabel: backgroundMode
      ? `这是后台任务，预计${formatT0DurationText(estimatedMinutes)}完成。你无需停留等待，可以继续完善建档或生成内容。`
      : undefined,
  };
}

export function buildAiDiagnosisRerunConfirmCopy(): AiDiagnosisRerunConfirmCopy {
  return {
    title: "确认重新运行 AI 实测诊断？",
    body: "重新诊断会生成新的诊断结果，不会删除历史记录。请确认是否继续。",
    confirmLabel: "确认重新诊断",
    cancelLabel: "取消",
  };
}

export function countEnabledQuestionsForT0(
  questions: Array<{ enabled?: number | boolean | null }>,
): number {
  return questions.filter(q => Number(q.enabled) !== 0).length;
}

/** 未完成 AI 现状检测时的推荐性引导（非阻断） */
export const AI_DIAGNOSIS_SOFT_RECOMMENDATION =
  "建议先完成 AI 现状检测，这样后续生成的内容能更精准地针对 AI 推荐短板。你也可以先继续完善其他模块，AI 现状检测可以随时进行。";
