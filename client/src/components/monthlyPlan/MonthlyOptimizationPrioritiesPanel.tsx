import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { MonthlyOptimizationBrief } from "@shared/monthlyOptimizationBrief";
import { ArrowRight, CalendarClock, CheckCircle2, Circle, ListChecks } from "lucide-react";

function taskStatusLabel(status: string): string {
  if (status === "completed") return "已完成";
  if (status === "in_progress") return "进行中";
  if (status === "suggested") return "建议动作";
  return "待处理";
}

function taskStatusClass(status: string): string {
  if (status === "completed") return "bg-emerald-50 text-emerald-700";
  if (status === "in_progress") return "bg-blue-50 text-blue-700";
  if (status === "suggested") return "bg-purple-50 text-purple-700";
  return "bg-amber-50 text-amber-700";
}

export function MonthlyOptimizationPrioritiesPanel({
  brief,
  loading,
  compact = false,
  onGoTask,
}: {
  brief?: MonthlyOptimizationBrief | null;
  loading?: boolean;
  compact?: boolean;
  onGoTask?: (actionUrl: string) => void;
}) {
  if (loading) {
    return (
      <P0Card testId="monthly-optimization-priorities" className="flex items-center gap-2 text-sm text-gray-500">
        <Spinner className="size-4 text-blue-600" />
        正在生成本月优化优先级…
      </P0Card>
    );
  }

  if (!brief) return null;

  return (
    <P0Card testId="monthly-optimization-priorities" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">本月 Top 3 优化优先级</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-600">{brief.summary}</p>
        </div>
        <div className="rounded-xl bg-blue-50 px-4 py-3">
          <p className="text-xs font-medium text-blue-700">当前成熟度</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-blue-800">
            {brief.maturityScore} 分 · {brief.maturityLevel}
          </p>
        </div>
      </div>

      <ol className="divide-y divide-gray-100">
        {brief.priorities.map(priority => (
          <li key={priority.rank} className="py-4" data-testid={`monthly-optimization-priority-${priority.rank}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-blue-600">优先级 {priority.rank} · {priority.relatedDimensionName}</p>
                <h3 className="mt-1 text-base font-semibold text-gray-900">{priority.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{priority.reason}</p>
                {!compact ? <p className="mt-1 text-xs leading-5 text-gray-500">{priority.shortcoming}</p> : null}
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  priority.source === "existing_task" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600",
                )}
              >
                {priority.source === "existing_task" ? "来自本月任务" : "系统建议"}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {priority.tasks.map((task, index) => (
                <div key={`${priority.rank}-${task.id ?? index}`} className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {task.status === "completed" ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-gray-300" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{task.title}</p>
                      <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", taskStatusClass(task.status))}>
                        {taskStatusLabel(task.status)}
                      </span>
                    </div>
                  </div>
                  {onGoTask ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => onGoTask(task.actionUrl)}>
                      去处理
                      <ArrowRight className="ml-1.5 size-3.5" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            {!compact ? (
              <div className="mt-3 grid gap-2 text-xs leading-5 text-gray-600 sm:grid-cols-2">
                <p>
                  <span className="font-medium text-gray-800">完成标准：</span>
                  {priority.successCriteria}
                </p>
                <p>
                  <span className="font-medium text-gray-800">复测方式：</span>
                  {priority.retestMethod}
                </p>
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      {!compact ? (
        <div className="border-t border-gray-100 pt-4" data-testid="monthly-optimization-review-calendar">
          <div className="mb-2 flex items-center gap-2">
            <CalendarClock className="size-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">复测节奏</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {brief.reviewCalendar.map(item => (
              <div key={item.label} className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs font-semibold text-gray-900">{item.label} · {item.timing}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">{item.purpose}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </P0Card>
  );
}
