import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import type { PublishExecutionTabKey } from "@/components/publishing/PublishTaskQueueTable";

export type PublishOperatorMetric = {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "success" | "warning" | "danger";
};

export type PublishOperatorBlocker = {
  title: string;
  impact: string;
  nextAction: string;
};

export type PublishOperatorFlowStep = {
  label: string;
  status: "done" | "current" | "waiting";
  hint: string;
};

export type PublishOperatorTaskRow = {
  key: string;
  title: string;
  platformLabel: string;
  statusLabel: string;
  nextAction: string;
  operationLabel: string;
  afterPublishLabel: string;
  targetTab: PublishExecutionTabKey;
};

export type PublishOperatorAccountRow = {
  key: string;
  platformLabel: string;
  statusLabel: string;
  impact: string;
  nextStep: string;
  tone?: "success" | "warning" | "danger" | "default";
};

export type PublishOperatorPublishedRow = {
  key: string;
  title: string;
  platformLabel: string;
  statusLabel: string;
  nextStep: string;
  publicLinkLabel: string;
};

export type PublishOperatorPrimaryAction = {
  label: string;
  hint: string;
  onClick: () => void;
};

type Props = {
  conclusion: string;
  localAgentNeedLabel: string;
  metrics: PublishOperatorMetric[];
  blockers: PublishOperatorBlocker[];
  flowSteps: PublishOperatorFlowStep[];
  primaryAction: PublishOperatorPrimaryAction;
  pendingTasks: PublishOperatorTaskRow[];
  accountRows: PublishOperatorAccountRow[];
  publishedRows: PublishOperatorPublishedRow[];
  onOpenTaskTab: (tab: PublishExecutionTabKey) => void;
  onOpenAccountTools: () => void;
  onOpenVerification: () => void;
};

function metricToneClass(tone: PublishOperatorMetric["tone"]): string {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "danger":
      return "border-red-200 bg-red-50 text-red-900";
    default:
      return "border-gray-200 bg-white text-gray-900";
  }
}

function accountToneClass(tone: PublishOperatorAccountRow["tone"]): string {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "danger":
      return "border-red-200 bg-red-50 text-red-800";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function flowStepClass(status: PublishOperatorFlowStep["status"]): string {
  switch (status) {
    case "done":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "current":
      return "border-blue-200 bg-blue-50 text-blue-800";
    default:
      return "border-gray-200 bg-gray-50 text-gray-600";
  }
}

export function PublishOperatorOverview({
  conclusion,
  localAgentNeedLabel,
  metrics,
  blockers,
  flowSteps,
  primaryAction,
  pendingTasks,
  accountRows,
  publishedRows,
  onOpenTaskTab,
  onOpenAccountTools,
  onOpenVerification,
}: Props) {
  return (
    <section className="space-y-5" data-testid="publish-operator-overview">
      <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <p className="text-xs font-medium text-blue-600">代理运营工具 · 发布执行中心</p>
            <h2 className="text-xl font-semibold text-gray-900">今天最该处理的发布工作</h2>
            <p className="text-sm leading-6 text-gray-600" data-testid="publish-operator-conclusion">
              {conclusion}
            </p>
          </div>
          <div className="shrink-0 rounded-lg border border-blue-100 bg-blue-50 p-3">
            <Button
              type="button"
              className={geoP0Brand.primary}
              data-testid="publish-operator-primary-cta"
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
            <p className="mt-2 max-w-[15rem] text-xs text-blue-800">{primaryAction.hint}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="publish-operator-metrics">
          {metrics.map(metric => (
            <div key={metric.label} className={`rounded-lg border p-4 ${metricToneClass(metric.tone)}`}>
              <p className="text-xs font-medium opacity-80">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
              <p className="mt-1 text-xs opacity-80">{metric.hint}</p>
            </div>
          ))}
        </div>
        <details className="mt-4 rounded-lg border border-blue-100 bg-white" data-testid="publish-local-agent-summary-fold">
          <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-gray-700">
            发布助手状态
            <span className="ml-2 font-normal text-gray-500">默认收起，不作为首屏决策信息</span>
          </summary>
          <p className="border-t border-blue-50 px-4 py-3 text-xs leading-5 text-gray-500">
            当前是否需要本地发布助手：<span className="font-medium text-gray-800">{localAgentNeedLabel}</span>
          </p>
        </details>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="publish-operator-blockers">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">当前卡点</h2>
              <p className="mt-1 text-xs text-gray-500">只展示最影响发布闭环的 3 个运营事项。</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {blockers.length > 0 ? (
              blockers.map(blocker => (
                <div key={blocker.title} className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">{blocker.title}</p>
                  <p className="mt-1 text-xs text-amber-800">影响：{blocker.impact}</p>
                  <p className="mt-1 text-xs text-amber-900">下一步：{blocker.nextAction}</p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                暂无明显发布卡点。建议继续跟进已发布内容的效果验证。
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="publish-operator-flow">
          <h2 className="text-base font-semibold text-gray-900">发布流程进度</h2>
          <p className="mt-1 text-xs text-gray-500">当前页面聚焦“发布执行”，后续进入效果验证和报告。</p>
          <div className="mt-4 grid gap-2">
            {flowSteps.map(step => (
              <div key={step.label} className={`rounded-lg border px-3 py-2 ${flowStepClass(step.status)}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{step.label}</span>
                  <span className="text-xs">
                    {step.status === "done" ? "已完成" : step.status === "current" ? "进行中" : "待开始"}
                  </span>
                </div>
                <p className="mt-1 text-xs opacity-80">{step.hint}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="publish-pending-task-operator-list">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">今天要发布什么</h2>
            <p className="mt-1 text-xs text-gray-500">只展示最需要处理的 3 个任务；完整队列在下方任务区。</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            onClick={() => onOpenTaskTab("pending")}
          >
            查看完整队列
          </Button>
        </div>
        {pendingTasks.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {pendingTasks.slice(0, 3).map(task => (
              <div key={task.key} className="rounded-lg border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                    <p className="mt-1 text-xs text-gray-500">{task.platformLabel} · {task.statusLabel}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={geoP0Brand.primaryOutline}
                    onClick={() => onOpenTaskTab(task.targetTab)}
                  >
                    {task.operationLabel}
                  </Button>
                </div>
                <p className="mt-3 text-xs text-gray-700">下一步：{task.nextAction}</p>
                <p className="mt-1 text-xs text-gray-500">发布后：{task.afterPublishLabel}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
            暂无待处理发布任务。若本月还未生成内容，请先回到执行进度生成可发布内容。
          </div>
        )}
      </section>

      <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="publish-account-operator-status">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900">
          <span>平台账号状态</span>
          <span className="text-xs font-normal text-gray-500">账号环境明细默认收起</span>
        </summary>
        <div className="border-t border-gray-100 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">用运营语言展示平台是否可发布；技术细节已折叠到高级区。</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={geoP0Brand.primaryOutline}
              onClick={onOpenAccountTools}
            >
              查看账号环境
            </Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {accountRows.map(row => (
              <div key={row.key} className="rounded-lg border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{row.platformLabel}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${accountToneClass(row.tone)}`}>
                    {row.statusLabel}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-600">影响：{row.impact}</p>
                <p className="mt-1 text-xs text-gray-500">下一步：{row.nextStep}</p>
              </div>
            ))}
          </div>
        </div>
      </details>

      <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="publish-published-verification">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900">
          <span>已发布，等待效果验证</span>
          <span className="text-xs font-normal text-gray-500">发布后证据默认收起</span>
        </summary>
        <div className="border-t border-gray-100 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">发布不是结束，下一步要确认内容是否被搜索和 AI 看见。</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={geoP0Brand.primaryOutline}
              onClick={onOpenVerification}
            >
              去效果验证
            </Button>
          </div>
          {publishedRows.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {publishedRows.map(row => (
                <div key={row.key} className="rounded-lg border border-gray-100 p-4">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2">{row.title}</p>
                  <p className="mt-1 text-xs text-gray-500">{row.platformLabel} · {row.statusLabel}</p>
                  <p className="mt-2 text-xs text-gray-700">公开链接：{row.publicLinkLabel}</p>
                  <p className="mt-1 text-xs text-gray-500">下一步：{row.nextStep}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
              暂无已发布待验证内容。完成发布并回填公开链接后，会在这里进入效果验证。
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
