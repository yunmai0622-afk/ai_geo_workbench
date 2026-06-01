import { Progress } from "@/components/ui/progress";
import {
  AI_TASK_PROGRESS_KEEP_OPEN_HINT,
  type AiTaskProgressErrorCategory,
} from "@shared/aiTaskProgress";
import { formatAiTaskProgressFailure } from "@/lib/aiTaskProgressErrors";

export type AiTaskProgressCardProps = {
  testId?: string;
  title: string;
  stepLabel: string;
  stepDescription?: string;
  percent: number;
  elapsedSec: number;
  hint30s?: string;
  hint60s?: string;
  hint90s?: string;
  status: "running" | "success" | "failed";
  errorCategory?: AiTaskProgressErrorCategory;
  errorMessage?: string;
};

export function AiTaskProgressCard({
  testId = "ai-task-progress-card",
  title,
  stepLabel,
  stepDescription,
  percent,
  elapsedSec,
  hint30s,
  hint60s,
  hint90s,
  status,
  errorCategory,
  errorMessage,
}: AiTaskProgressCardProps) {
  const timedHint =
    status === "running" && elapsedSec >= 90 && hint90s
      ? hint90s
      : status === "running" && elapsedSec >= 60 && hint60s
        ? hint60s
        : status === "running" && elapsedSec >= 30 && hint30s
          ? hint30s
          : null;

  const failure =
    status === "failed" && errorCategory
      ? formatAiTaskProgressFailure(errorCategory, errorMessage ?? "")
      : null;

  return (
    <div
      className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm"
      data-testid={testId}
      data-status={status}
      data-percent={percent}
      data-elapsed-sec={elapsedSec}
    >
      <p className="text-sm font-semibold text-gray-900" data-testid={`${testId}-title`}>
        {title}
      </p>
      <Progress
        className="mt-3 h-2 bg-blue-100 [&_[data-slot=progress-indicator]]:bg-blue-600"
        value={percent}
        data-testid={`${testId}-bar`}
      />
      <div className="mt-3 space-y-1 text-sm text-gray-700">
        <p data-testid={`${testId}-step`}>
          当前步骤：<span className="font-medium text-gray-900">{stepLabel}</span>
        </p>
        {stepDescription ? (
          <p className="text-gray-600" data-testid={`${testId}-step-description`}>
            {stepDescription}
          </p>
        ) : null}
        <p data-testid={`${testId}-percent`}>进度：{percent}%</p>
        <p data-testid={`${testId}-elapsed`}>已耗时：{elapsedSec} 秒</p>
      </div>
      {status === "running" ? (
        <p className="mt-2 text-xs text-blue-800/90" data-testid={`${testId}-keep-open`}>
          {AI_TASK_PROGRESS_KEEP_OPEN_HINT}
        </p>
      ) : null}
      {timedHint ? (
        <p className="mt-2 text-xs font-medium text-amber-800" data-testid={`${testId}-slow-hint`}>
          {timedHint}
        </p>
      ) : null}
      {failure ? (
        <div
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          data-testid={`${testId}-error`}
          data-error-category={errorCategory}
        >
          <p className="font-medium">失败原因：{failure.categoryLabel}</p>
          <p className="mt-1">{failure.message}</p>
          <p className="mt-1 text-xs text-red-700/90">建议：{failure.nextStep}</p>
        </div>
      ) : null}
    </div>
  );
}
