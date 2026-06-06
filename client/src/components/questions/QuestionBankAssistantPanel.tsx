import { Button } from "@/components/ui/button";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import {
  buildQuestionBankAssistantBlockers,
  buildQuestionBankOverviewMetrics,
  countQuestionsMissingIntent,
  QUESTION_BANK_ASSISTANT_SUGGESTIONS,
  resolveQuestionBankAssistantNextAction,
  type QuestionBankRow,
} from "@shared/questionBankIntentMap";
import { useMemo } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";

export function QuestionBankAssistantPanel() {
  const { selectedProjectId, enabled } = useActiveProjectSelection();
  const [, setLocation] = useLocation();

  const questionsQuery = trpc.geo.questions.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const testRoundsQuery = trpc.geo.testRounds.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const workspaceSummaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const tasksQuery = trpc.geo.tasks.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );

  const view = useMemo(() => {
    const questions = (questionsQuery.data ?? []) as QuestionBankRow[];
    const rounds = testRoundsQuery.data ?? [];
    const currentRound =
      rounds.find(round => round.status === "running") ??
      rounds.find(round => round.roundType === "T0_BASELINE") ??
      null;
    const missingIntentCount = countQuestionsMissingIntent(questions);
    const hasCompletedT0Baseline = Boolean(workspaceSummaryQuery.data?.hasCompletedT0Baseline);
    const overview = buildQuestionBankOverviewMetrics({
      questions,
      currentRoundQuestionCount: currentRound?.questionsCount ?? questions.filter(q => Number(q.enabled) !== 0).length,
      contentTaskCount: tasksQuery.data?.length ?? 0,
      hasCompletedT0Baseline,
    });
    return {
      blockers: buildQuestionBankAssistantBlockers({
        hasCurrentRound: Boolean(currentRound),
        missingIntentCount,
      }),
      suggestions: [...QUESTION_BANK_ASSISTANT_SUGGESTIONS],
      nextAction: resolveQuestionBankAssistantNextAction({
        totalQuestions: overview.total,
        enabledCount: overview.enabledCount,
        hasCurrentRound: Boolean(currentRound),
        roundStatus: currentRound?.status ?? null,
        hasCompletedT0Baseline,
        gapCount: overview.gapCount,
      }),
    };
  }, [questionsQuery.data, testRoundsQuery.data, workspaceSummaryQuery.data, tasksQuery.data]);

  function goAiDiagnosis() {
    if (!selectedProjectId) return;
    setLocation(buildProjectUrl("/ai-diagnosis", selectedProjectId));
  }

  return (
    <aside className="w-full space-y-4" data-testid="question-bank-assistant-panel">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">问题库助手</h3>

        <div className="mt-4 space-y-4">
          <div data-testid="question-assistant-suggestions">
            <p className="text-xs font-semibold text-gray-500">当前建议</p>
            <ul className="mt-1 space-y-1 text-sm text-gray-800">
              {view.suggestions.map(item => (
                <li key={item} className="flex gap-2">
                  <span className="text-gray-400">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div data-testid="question-assistant-blockers">
            <p className="text-xs font-semibold text-gray-500">当前阻断</p>
            {view.blockers.length === 0 ? (
              <p className="mt-1 text-sm text-gray-600">暂无阻断，可继续选择问题并创建实测题组。</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm text-gray-800">
                {view.blockers.map(item => (
                  <li key={item} className="flex gap-2">
                    <span className="text-gray-400">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div data-testid="question-assistant-next-action">
            <p className="text-xs font-semibold text-gray-500">下一步动作</p>
            <p className="mt-1 text-sm text-gray-800">{view.nextAction}</p>
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              className={`w-full ${geoP0Brand.primary}`}
              data-testid="question-assistant-create-round"
              disabled={!selectedProjectId}
              onClick={goAiDiagnosis}
            >
              创建本轮实测题组
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              data-testid="question-assistant-go-diagnosis"
              disabled={!selectedProjectId}
              onClick={goAiDiagnosis}
            >
              去 AI 实测诊断
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
