import { appendWeeklyContentEntryParams } from "./weeklyContentEntryContext";

export type QuestionContentTaskCandidate = {
  id: number;
  enabled?: number | boolean | null;
  hasContentTask?: boolean | null;
};

export function selectTopContentTaskCandidates<
  T extends QuestionContentTaskCandidate,
>(topQuestionIds: readonly number[], questions: readonly T[], limit = 3): T[] {
  const byId = new Map(questions.map(question => [question.id, question]));
  const selected: T[] = [];
  const seen = new Set<number>();
  for (const questionId of topQuestionIds) {
    if (seen.has(questionId)) continue;
    seen.add(questionId);
    const question = byId.get(questionId);
    if (!question || question.hasContentTask || Number(question.enabled) === 0)
      continue;
    selected.push(question);
    if (selected.length >= limit) break;
  }
  return selected;
}

export function buildContentProductionListUrl(projectId: number): string {
  return `/weekly?mode=content-production&projectId=${projectId}`;
}

export function buildQuestionContentTaskUrl(
  projectId: number,
  questionId: number
): string {
  return appendWeeklyContentEntryParams(
    buildContentProductionListUrl(projectId),
    {
      questionId,
      sourceType: "optimization_task",
    }
  );
}
