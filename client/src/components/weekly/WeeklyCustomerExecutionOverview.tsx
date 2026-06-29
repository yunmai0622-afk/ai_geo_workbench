import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces, stageBadgeClass } from "@/lib/geoP0Visual";
import type { MonthlyContentTaskItem } from "@/components/weekly/ContentTaskProgressionView";
import type { TaskBoardProgressMetrics } from "@shared/weeklyContentTaskBoard";
import type { WeeklyContentTaskProgress } from "@shared/weeklyContentTaskStatus";
import { ArrowRight, CheckCircle2, Clock3, FileText, Send, ShieldAlert } from "lucide-react";

type WeeklyCustomerExecutionOverviewProps = {
  brandName: string;
  projectStageLabel: string;
  monthlyTasks: MonthlyContentTaskItem[];
  progress: WeeklyContentTaskProgress;
  currentTaskProgress: TaskBoardProgressMetrics | null;
  currentTaskTitle?: string | null;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
};

function taskStatusLabel(status: string): string {
  if (status === "completed") return "已完成";
  if (status === "in_progress") return "进行中";
  return "待推进";
}

function taskStatusClass(status: string): string {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "in_progress") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function formatTaskProgress(done: number, total: number): string {
  if (total <= 0) return "暂无";
  return `${done}/${total} 项`;
}

function buildExecutionConclusion(input: {
  brandName: string;
  taskCount: number;
  completedTaskCount: number;
  progress: WeeklyContentTaskProgress;
}): string {
  const { brandName, taskCount, completedTaskCount, progress } = input;
  if (taskCount === 0) {
    return `${brandName} 本月还没有形成可执行的内容服务事项，建议先回到本月方案，把诊断问题转成可交付动作。`;
  }
  if (progress.publishedCount > 0) {
    return `${brandName} 本月已有内容完成发布，下一步重点是确认内容是否被搜索和 AI 看见，并进入效果验证。`;
  }
  if (progress.queuedCount > 0 || progress.enqueueReadyCount > 0) {
    return `${brandName} 本月内容资产已进入发布前准备阶段，当前重点是完成入队、发布和链接回填。`;
  }
  if (progress.pendingReviewCount > 0) {
    return `${brandName} 本月内容已生成，当前重点是完成质量确认，避免未审核内容直接进入发布。`;
  }
  if (progress.generatedCount > 0) {
    return `${brandName} 本月内容资产正在建设中，下一步是把已生成内容确认到可发布状态。`;
  }
  return `${brandName} 本月已有 ${taskCount} 项服务事项，已完成 ${completedTaskCount} 项，下一步先推进第一批内容资产生成。`;
}

function buildBlockers(input: {
  taskCount: number;
  progress: WeeklyContentTaskProgress;
  currentTaskProgress: TaskBoardProgressMetrics | null;
}): Array<{ title: string; impact: string; action: string }> {
  const blockers: Array<{ title: string; impact: string; action: string }> = [];
  const { taskCount, progress, currentTaskProgress } = input;

  if (taskCount === 0) {
    blockers.push({
      title: "本月服务事项未形成",
      impact: "客户暂时看不到本月准备交付什么，也无法判断执行是否推进。",
      action: "先回到本月方案，把诊断问题转成 Top 服务事项。",
    });
  }
  if (taskCount > 0 && progress.generatedCount === 0) {
    blockers.push({
      title: "内容资产尚未生成",
      impact: "AI 还缺少可引用的公开内容，短期内推荐表现很难改善。",
      action: "优先选择一个任务进入推进，生成第一批平台内容。",
    });
  }
  if (progress.pendingReviewCount > 0) {
    blockers.push({
      title: "内容待确认",
      impact: "内容没有通过质检前，不适合进入发布，可能影响客户对交付质量的信任。",
      action: `先确认 ${progress.pendingReviewCount} 篇内容，再进入发布。`,
    });
  }
  if (progress.enqueueReadyCount > 0) {
    blockers.push({
      title: "可发布内容尚未入队",
      impact: "内容已经准备好，但还没有真正进入发布动作，客户看不到外部证据增长。",
      action: `将 ${progress.enqueueReadyCount} 篇可发布内容加入发布队列。`,
    });
  }
  if (progress.queuedCount > 0 && progress.publishedCount === 0) {
    blockers.push({
      title: "发布后证据尚未形成",
      impact: "内容已进入发布流程，但还需要确认是否实际发布并回填公开链接。",
      action: "进入发布页面，确认发布状态和链接。",
    });
  }
  if (progress.publishedCount > 0) {
    blockers.push({
      title: "发布后尚需验证效果",
      impact: "内容发布只是第一步，还需要确认是否被搜索和 AI 看见。",
      action: "进入效果验证，检查收录、提及和后续复测安排。",
    });
  }
  if (currentTaskProgress && currentTaskProgress.needGenerate > 0 && currentTaskProgress.generated > 0) {
    blockers.push({
      title: "部分平台内容还没补齐",
      impact: "不同平台的信源覆盖不均衡，AI 可引用证据仍然不完整。",
      action: `继续补齐 ${currentTaskProgress.needGenerate} 个平台的内容。`,
    });
  }

  if (blockers.length === 0) {
    blockers.push({
      title: "暂无明显执行卡点",
      impact: "当前执行链路没有发现需要立即处理的阻断。",
      action: "按计划继续推进，并在发布后进入效果验证。",
    });
  }

  return blockers.slice(0, 3);
}

function buildFlowSteps(input: {
  taskCount: number;
  progress: WeeklyContentTaskProgress;
}): Array<{ label: string; status: "已完成" | "进行中" | "待开始"; hint: string }> {
  const { taskCount, progress } = input;
  const hasTasks = taskCount > 0;
  const hasGenerated = progress.generatedCount > 0;
  const hasPublishMotion = progress.enqueueReadyCount > 0 || progress.queuedCount > 0 || progress.publishedCount > 0;
  const hasPublished = progress.publishedCount > 0;

  return [
    {
      label: "本月方案",
      status: hasTasks ? "已完成" : "进行中",
      hint: hasTasks ? "已形成本月内容服务事项。" : "先确认本月要解决的问题。",
    },
    {
      label: "内容生成",
      status: hasGenerated ? "已完成" : hasTasks ? "进行中" : "待开始",
      hint: hasGenerated ? "已有内容资产进入后续处理。" : "将服务事项转成平台内容。",
    },
    {
      label: "质检与发布",
      status: hasPublished ? "已完成" : hasPublishMotion ? "进行中" : "待开始",
      hint: hasPublishMotion ? "发布链路已启动或有内容可发布。" : "内容确认后进入发布。",
    },
    {
      label: "效果验证",
      status: hasPublished ? "进行中" : "待开始",
      hint: hasPublished ? "确认内容是否被搜索和 AI 看见。" : "发布后再验证效果。",
    },
  ];
}

export function WeeklyCustomerExecutionOverview({
  brandName,
  projectStageLabel,
  monthlyTasks,
  progress,
  currentTaskProgress,
  currentTaskTitle,
  primaryActionLabel,
  onPrimaryAction,
}: WeeklyCustomerExecutionOverviewProps) {
  const completedTaskCount = monthlyTasks.filter(task => task.status === "completed").length;
  const serviceProgress = formatTaskProgress(completedTaskCount, monthlyTasks.length);
  const conclusion = buildExecutionConclusion({
    brandName,
    taskCount: monthlyTasks.length,
    completedTaskCount,
    progress,
  });
  const blockers = buildBlockers({
    taskCount: monthlyTasks.length,
    progress,
    currentTaskProgress,
  });
  const flowSteps = buildFlowSteps({ taskCount: monthlyTasks.length, progress });
  const visibleTasks = monthlyTasks.slice(0, 3);
  const currentTaskLabel = currentTaskTitle?.trim() || visibleTasks[0]?.title || "待选择执行事项";

  const metrics = [
    {
      label: "本月服务事项",
      value: serviceProgress,
      hint: monthlyTasks.length > 0 ? "按本月方案推进" : "待制定方案",
      icon: FileText,
    },
    {
      label: "内容资产建设",
      value: `${progress.generatedCount} 篇`,
      hint: progress.generatedCount > 0 ? "已进入内容资产池" : "待生成第一批内容",
      icon: CheckCircle2,
    },
    {
      label: "待发布内容",
      value: `${progress.enqueueReadyCount + progress.queuedCount} 篇`,
      hint: progress.enqueueReadyCount > 0 ? "可进入发布队列" : "暂无可发布内容",
      icon: Send,
    },
    {
      label: "已发布待验证",
      value: `${progress.publishedCount} 篇`,
      hint: progress.publishedCount > 0 ? "可进入效果验证" : "发布后验证效果",
      icon: Clock3,
    },
  ];

  return (
    <section className="space-y-6" data-testid="weekly-customer-execution-overview">
      <P0Card className="border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={stageBadgeClass(projectStageLabel)}>{projectStageLabel}</span>
              <span className="rounded-full border border-blue-100 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                客户可见执行进度
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-700">一句话执行结论</p>
              <h2 className="mt-1 text-2xl font-bold leading-tight text-gray-900">
                {brandName} 本月执行进度
              </h2>
              <p className="mt-3 text-sm leading-7 text-gray-700" data-testid="weekly-execution-conclusion">
                {conclusion}
              </p>
            </div>
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">当前推进事项</p>
            <p className="mt-1 text-base font-semibold leading-snug text-gray-900" data-testid="weekly-current-execution-task">
              {currentTaskLabel}
            </p>
            <Button
              type="button"
              className={`mt-4 w-full ${geoP0Brand.primary}`}
              data-testid="weekly-execution-primary-cta"
              onClick={onPrimaryAction}
            >
              {primaryActionLabel}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </P0Card>

      <div className="grid gap-3 md:grid-cols-4" data-testid="weekly-execution-metrics">
        {metrics.map(metric => {
          const Icon = metric.icon;
          return (
            <P0Card key={metric.label} className="p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-xs font-medium text-gray-500">{metric.label}</p>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-gray-900">{metric.value}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{metric.hint}</p>
            </P0Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]" data-testid="weekly-execution-progress-grid">
        <section className="space-y-3" data-testid="weekly-execution-top-blockers">
          <div className="space-y-1">
            <h2 className={geoP0Surfaces.sectionTitle}>当前卡点</h2>
            <p className={geoP0Surfaces.muted}>只展示客户能理解、交付人员可以立刻处理的问题。</p>
          </div>
          <div className="space-y-3">
            {blockers.map((item, index) => (
              <P0Card key={`${item.title}-${index}`} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                    <ShieldAlert className="h-4 w-4" />
                  </span>
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    <p className="text-sm leading-relaxed text-gray-600">影响：{item.impact}</p>
                    <p className="text-sm leading-relaxed text-blue-700">下一步：{item.action}</p>
                  </div>
                </div>
              </P0Card>
            ))}
          </div>
        </section>

        <section className="space-y-3" data-testid="weekly-execution-flow">
          <div className="space-y-1">
            <h2 className={geoP0Surfaces.sectionTitle}>服务流程进度</h2>
            <p className={geoP0Surfaces.muted}>从本月方案到效果验证，客户能看到当前卡在哪一步。</p>
          </div>
          <P0Card className="space-y-3 p-4">
            {flowSteps.map((step, index) => (
              <div key={step.label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={[
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                      step.status === "已完成"
                        ? "bg-emerald-100 text-emerald-700"
                        : step.status === "进行中"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-500",
                    ].join(" ")}
                  >
                    {index + 1}
                  </span>
                  {index < flowSteps.length - 1 ? <span className="h-8 w-px bg-gray-200" /> : null}
                </div>
                <div className="min-w-0 flex-1 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900">{step.label}</p>
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                      {step.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{step.hint}</p>
                </div>
              </div>
            ))}
          </P0Card>
        </section>
      </div>

      <section className="space-y-3" data-testid="weekly-execution-service-items">
        <div className="space-y-1">
          <h2 className={geoP0Surfaces.sectionTitle}>本月 Top 3 执行事项</h2>
          <p className={geoP0Surfaces.muted}>把运营任务翻译成客户能理解的服务动作。</p>
        </div>
        {visibleTasks.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {visibleTasks.map(task => (
              <P0Card key={task.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-snug text-gray-900">{task.title}</p>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${taskStatusClass(task.status)}`}>
                    {taskStatusLabel(task.status)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-gray-600">{task.reason}</p>
                <p className="mt-auto text-xs leading-relaxed text-blue-700">
                  当前状态：{task.laggingLifecycleLabel ?? "等待进入内容推进"}
                </p>
              </P0Card>
            ))}
          </div>
        ) : (
          <P0Card className="p-4">
            <p className="text-sm leading-relaxed text-gray-600">
              暂无本月执行事项。建议先进入本月方案，确认本月要解决的 Top 服务事项。
            </p>
          </P0Card>
        )}
      </section>
    </section>
  );
}
