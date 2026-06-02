export type T0StartConfirmInput = {
  questionCount: number;
  platformCount: number;
  runsPerQuestion?: number;
};

export type T0StartConfirmCopy = {
  title: string;
  intro: string;
  questionCount: number;
  platformCount: number;
  estimatedMinutes: number;
  footerNote: string;
  confirmLabel: string;
  cancelLabel: string;
};

export type AiDiagnosisRerunConfirmCopy = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
};

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
  const estimatedMinutes = estimateT0DiagnosisMinutes(input);

  return {
    title: "确认开始 T0 基线检测？",
    intro: "本次将基于当前启用的问题和 AI 平台进行真实检测。",
    questionCount,
    platformCount,
    estimatedMinutes,
    footerNote: "检测会调用模型服务，请保持页面打开。检测结果将作为本项目的 T0 基线。",
    confirmLabel: "确认开始检测",
    cancelLabel: "取消",
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
