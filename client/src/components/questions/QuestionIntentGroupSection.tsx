import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Badge } from "@/components/ui/badge";
import type { QuestionBankRow, QuestionIntentGroupStats } from "@shared/questionBankIntentMap";
import { QuestionBankCard } from "./QuestionBankCard";

type Props = {
  groupKey: string;
  label: string;
  defaultOpen: boolean;
  stats: QuestionIntentGroupStats;
  questions: QuestionBankRow[];
  testedQuestionIds: ReadonlySet<number>;
  hasCompletedT0Baseline: boolean;
  articles: Array<{ status?: string | null; generationBasis?: Record<string, unknown> | null }>;
  mutating: boolean;
  projectId: number | null;
  onToggle: (question: QuestionBankRow, nextEnabled: boolean) => void;
  onEdit: (question: QuestionBankRow) => void;
  onDelete: (question: QuestionBankRow) => void;
};

export function QuestionIntentGroupSection({
  groupKey,
  label,
  defaultOpen,
  stats,
  questions,
  testedQuestionIds,
  hasCompletedT0Baseline,
  articles,
  mutating,
  projectId,
  onToggle,
  onEdit,
  onDelete,
}: Props) {
  if (questions.length === 0 && stats.total === 0) return null;

  return (
    <details
      open={defaultOpen ? true : undefined}
      className="rounded-xl border border-gray-200 bg-white"
      data-testid={`question-intent-group-${groupKey}`}
    >
      <summary className="cursor-pointer px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">问题 {stats.total}</Badge>
            <Badge variant="outline">已启用 {stats.enabled}</Badge>
            <Badge variant="outline">已实测 {stats.tested}</Badge>
            <Badge variant="outline">发现缺口 {stats.gapCount}</Badge>
            <Badge variant="outline">可生成内容 {stats.contentReadyCount}</Badge>
          </div>
        </div>
      </summary>
      <div className="space-y-3 border-t border-gray-100 p-4">
        {questions.length === 0 ? (
          <p className="text-sm text-gray-500">该意图下暂无问题，可通过「生成高质量问题」或手动添加补充。</p>
        ) : (
          questions.map(question => (
            <QuestionBankCard
              key={question.id}
              question={question}
              testedQuestionIds={testedQuestionIds}
              hasCompletedT0Baseline={hasCompletedT0Baseline}
              articles={articles}
              mutating={mutating}
              projectId={projectId}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </details>
  );
}

export function QuestionUnclassifiedGroupSection({
  questions,
  testedQuestionIds,
  hasCompletedT0Baseline,
  articles,
  mutating,
  projectId,
  onToggle,
  onEdit,
  onDelete,
}: Omit<Props, "groupKey" | "label" | "defaultOpen" | "stats">) {
  if (questions.length === 0) return null;

  return (
    <P0Card data-testid="question-intent-group-unclassified">
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">
          待整理问题（{questions.length}）
        </summary>
        <div className="mt-3 space-y-3">
          {questions.map(question => (
            <QuestionBankCard
              key={question.id}
              question={question}
              testedQuestionIds={testedQuestionIds}
              hasCompletedT0Baseline={hasCompletedT0Baseline}
              articles={articles}
              mutating={mutating}
              projectId={projectId}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </details>
    </P0Card>
  );
}
