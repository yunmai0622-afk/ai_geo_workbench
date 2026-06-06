import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildProjectUrl } from "@/lib/activeProject";
import {
  resolveTestRoundDisplayName,
  resolveTestRoundStatusLabel,
  type TestRoundSummary,
} from "@shared/questionBankIntentMap";
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

type Props = {
  projectId: number | null;
  currentRound: TestRoundSummary | null;
  enabledQuestionCount: number;
};

export function QuestionBankCurrentRoundPanel({ projectId, currentRound, enabledQuestionCount }: Props) {
  const [, setLocation] = useLocation();

  function goAiDiagnosis() {
    if (!projectId) return;
    setLocation(buildProjectUrl("/ai-diagnosis", projectId));
  }

  if (!currentRound) {
    return (
      <P0Card data-testid="question-bank-current-round-empty">
        <p className="text-sm font-semibold text-gray-900">本轮实测题组</p>
        <p className="mt-2 text-sm font-medium text-gray-800">暂无本轮实测题组</p>
        <p className="mt-1 text-sm text-gray-500">原因：</p>
        <p className="text-sm text-gray-600">
          请从问题库中选择 5-10 个高价值问题，用于建立 AI 搜索可见度基线。
        </p>
        <Button
          type="button"
          className="mt-4 bg-blue-600 text-white hover:bg-blue-700"
          data-testid="question-bank-create-round"
          disabled={!projectId || enabledQuestionCount === 0}
          onClick={goAiDiagnosis}
        >
          选择问题创建题组
        </Button>
      </P0Card>
    );
  }

  const roundLabel = resolveTestRoundDisplayName(currentRound);
  const statusLabel = resolveTestRoundStatusLabel(currentRound.status);
  const nextAction =
    currentRound.status === "completed"
      ? "查看实测结果"
      : currentRound.status === "running"
        ? "查看实测进度"
        : "开始 AI 实测";

  return (
    <P0Card data-testid="question-bank-current-round">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-900">本轮实测题组</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{roundLabel}</Badge>
            <Badge variant="secondary">包含 {currentRound.questionsCount} 个问题</Badge>
            <Badge variant="secondary">状态：{statusLabel}</Badge>
          </div>
          {currentRound.intentLabels.length > 0 ? (
            <p className="text-sm text-gray-600">
              覆盖意图：{currentRound.intentLabels.join("、")}
            </p>
          ) : (
            <p className="text-sm text-gray-500">覆盖意图：待选择问题后展示</p>
          )}
          <p className="text-sm text-gray-600">下一步动作：{nextAction}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            data-testid="question-bank-round-ai-test"
            disabled={!projectId}
            onClick={goAiDiagnosis}
          >
            "去 AI 实测诊断"
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
          {currentRound.status === "completed" ? (
            <Button
              type="button"
              variant="outline"
              data-testid="question-bank-round-generate-content"
              disabled={!projectId}
              onClick={() => projectId && setLocation(buildProjectUrl("/weekly", projectId))}
            >
              生成内容任务
            </Button>
          ) : null}
        </div>
      </div>
    </P0Card>
  );
}
