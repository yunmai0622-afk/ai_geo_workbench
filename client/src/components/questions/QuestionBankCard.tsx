import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buildProjectUrl } from "@/lib/activeProject";
import { buildWeeklyContentEntryUrl } from "@shared/weeklyContentEntryContext";
import {
  resolveQuestionContentStatus,
  resolveQuestionContentStatusHint,
  resolveQuestionIntentLabel,
  resolveQuestionNextAction,
  resolveQuestionPriorityLevel,
  resolveQuestionSourceLabel,
  resolveQuestionTestStatus,
  resolveQuestionTestStatusHint,
  type QuestionBankRow,
} from "@shared/questionBankIntentMap";
import { CircleHelp, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useLocation } from "wouter";

const PRIORITY_BADGE_CLASS = {
  高: "border-rose-200 bg-rose-50 text-rose-800",
  中: "border-amber-200 bg-amber-50 text-amber-800",
  低: "border-gray-200 bg-gray-50 text-gray-600",
} as const;

const TEST_STATUS_BADGE_CLASS = {
  未测: "border-gray-200 bg-gray-50 text-gray-600",
  已测: "border-sky-200 bg-sky-50 text-sky-800",
  发现缺口: "border-amber-200 bg-amber-50 text-amber-800",
  已覆盖: "border-emerald-200 bg-emerald-50 text-emerald-800",
} as const;

const CONTENT_STATUS_BADGE_CLASS = {
  未生成: "border-gray-200 bg-gray-50 text-gray-600",
  已生成: "border-blue-200 bg-blue-50 text-blue-800",
  已发布: "border-emerald-200 bg-emerald-50 text-emerald-800",
  待复测: "border-violet-200 bg-violet-50 text-violet-800",
} as const;

type Props = {
  question: QuestionBankRow;
  testedQuestionIds: ReadonlySet<number>;
  hasCompletedT0Baseline: boolean;
  articles: Array<{ status?: string | null; generationBasis?: Record<string, unknown> | null }>;
  mutating: boolean;
  projectId: number | null;
  onToggle: (question: QuestionBankRow, nextEnabled: boolean) => void;
  onEdit: (question: QuestionBankRow) => void;
  onDelete: (question: QuestionBankRow) => void;
};

function isQuestionEnabled(enabled: QuestionBankRow["enabled"]) {
  return Number(enabled) !== 0;
}

export function QuestionBankCard({
  question,
  testedQuestionIds,
  hasCompletedT0Baseline,
  articles,
  mutating,
  projectId,
  onToggle,
  onEdit,
  onDelete,
}: Props) {
  const [, setLocation] = useLocation();
  const priority = resolveQuestionPriorityLevel(question);
  const intentLabel = resolveQuestionIntentLabel(question);
  const sourceLabel = resolveQuestionSourceLabel(question);
  const testStatus = resolveQuestionTestStatus(question, testedQuestionIds, hasCompletedT0Baseline);
  const contentStatus = resolveQuestionContentStatus(question, articles);
  const testHint = resolveQuestionTestStatusHint(testStatus);
  const contentHint = resolveQuestionContentStatusHint(contentStatus);
  const nextAction = resolveQuestionNextAction({
    question,
    testedQuestionIds,
    hasCompletedT0Baseline,
    articles,
  });

  return (
    <P0Card className="!p-4" testId={`question-card-${question.id}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm leading-relaxed text-gray-900">{question.questionText}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs" data-testid={`question-intent-${question.id}`}>
              意图：{intentLabel}
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs ${PRIORITY_BADGE_CLASS[priority]}`}
              data-testid={`question-priority-${question.id}`}
            >
              优先级：{priority}
            </Badge>
            <Badge variant="outline" className="text-xs">
              来源：{sourceLabel}
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs ${TEST_STATUS_BADGE_CLASS[testStatus]}`}
              data-testid={`question-test-status-${question.id}`}
            >
              实测：{testStatus}
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs ${CONTENT_STATUS_BADGE_CLASS[contentStatus]}`}
              data-testid={`question-content-status-${question.id}`}
            >
              内容：{contentStatus}
            </Badge>
            {!isQuestionEnabled(question.enabled) ? (
              <Badge variant="secondary" className="text-xs text-gray-500">
                已停用
              </Badge>
            ) : null}
          </div>
          {testHint ? (
            <p className="text-xs leading-relaxed text-gray-500" data-testid={`question-test-empty-${question.id}`}>
              {testHint}
            </p>
          ) : null}
          {contentHint ? (
            <p
              className="text-xs leading-relaxed text-gray-500"
              data-testid={`question-content-empty-${question.id}`}
            >
              {contentHint}
            </p>
          ) : null}
          <p className="text-xs text-gray-600" data-testid={`question-next-action-${question.id}`}>
            下一步动作：{nextAction}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:min-w-[220px]">
          <div className="flex items-center gap-2">
            <Label htmlFor={`toggle-${question.id}`} className="text-xs text-gray-500">
              启用
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center text-gray-400 transition-colors hover:text-gray-600"
                  aria-label="查看启用说明"
                >
                  <CircleHelp className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="max-w-64 leading-relaxed">
                启用后将进入下一轮 AI 实测与内容生产候选范围。
              </TooltipContent>
            </Tooltip>
            <Switch
              id={`toggle-${question.id}`}
              checked={isQuestionEnabled(question.enabled)}
              disabled={mutating}
              onCheckedChange={checked => onToggle(question, checked)}
              data-testid={`question-toggle-${question.id}`}
            />
          </div>
          <p className="text-xs text-gray-500" data-testid={`question-enable-hint-${question.id}`}>
            启用后将进入下一轮 AI 实测与内容生产候选范围。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!projectId}
              data-testid={`question-view-test-${question.id}`}
              onClick={() => projectId && setLocation(buildProjectUrl("/ai-diagnosis", projectId))}
            >
              查看实测
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!projectId}
              data-testid={`question-generate-content-${question.id}`}
              onClick={() =>
                projectId &&
                setLocation(
                  buildWeeklyContentEntryUrl(projectId, {
                    questionId: question.id,
                    questionText: question.questionText,
                    sourceType: "question_pool",
                    autoGenerate: true,
                  }),
                )
              }
            >
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              生成内容
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:text-gray-900"
              disabled={mutating}
              onClick={() => onEdit(question)}
              aria-label="编辑问题"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-700"
              disabled={mutating}
              onClick={() => onDelete(question)}
              aria-label="删除问题"
              data-testid={`question-delete-${question.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </P0Card>
  );
}
