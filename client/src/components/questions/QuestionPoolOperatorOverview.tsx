import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { P0Card } from "@/components/geo/P0UiPrimitives";
import { geoP0Brand } from "@/lib/geoP0Visual";

export type QuestionOperatorMetric = {
  label: string;
  value: string;
  hint: string;
};

export type QuestionOperatorScenario = {
  key: string;
  label: string;
  count: number;
  aiPerformance: string;
  contentCoverage: string;
  nextAction: string;
};

export type QuestionOperatorTopItem = {
  key: string;
  questionText: string;
  aiPerformance: string;
  reason: string;
  contentStatus: string;
  nextAction: string;
  badgeLabel: string;
};

export type QuestionOperatorTaskLink = {
  key: string;
  label: string;
  value: string;
  hint: string;
};

export type QuestionOperatorPrimaryAction = {
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
};

type Props = {
  conclusion: string;
  metrics: QuestionOperatorMetric[];
  scenarios: QuestionOperatorScenario[];
  topItems: QuestionOperatorTopItem[];
  taskLinks: QuestionOperatorTaskLink[];
  primaryAction: QuestionOperatorPrimaryAction;
};

export function QuestionPoolOperatorOverview({
  conclusion,
  metrics,
  scenarios,
  topItems,
  taskLinks,
  primaryAction,
}: Props) {
  const firstDecision = topItems[0] ?? null;

  return (
    <section className="space-y-5" data-testid="question-operator-overview">
      <P0Card className="border-blue-100 bg-blue-50/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-blue-700">运营工具 · AI 搜索机会与内容选题</p>
            <h2 className="mt-2 text-xl font-bold text-gray-950">本月应该优先优化哪些 AI 搜索问题</h2>
            <p className="mt-2 text-sm leading-6 text-gray-700" data-testid="question-operator-conclusion">
              {conclusion}
            </p>
          </div>
          <div className="shrink-0 rounded-lg border border-blue-100 bg-white p-3">
            <Button
              type="button"
              className={geoP0Brand.primary}
              disabled={primaryAction.disabled}
              onClick={primaryAction.onClick}
              data-testid="question-operator-primary-cta"
            >
              {primaryAction.label}
            </Button>
            <p className="mt-2 max-w-[15rem] text-xs leading-5 text-gray-500">{primaryAction.hint}</p>
          </div>
        </div>

        <div
          className="mt-5 rounded-xl border border-blue-100 bg-white p-4"
          data-testid="question-operator-first-decision"
        >
          <p className="text-xs font-semibold text-blue-700">今日选题决策</p>
          {firstDecision ? (
            <div className="mt-2 grid gap-3 lg:grid-cols-[1fr_0.75fr]">
              <div>
                <h3 className="text-lg font-bold leading-7 text-gray-950">{firstDecision.questionText}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  为什么值得做：{firstDecision.reason}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-900">下一步：{firstDecision.nextAction}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">AI 表现：{firstDecision.aiPerformance}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">内容状态：{firstDecision.contentStatus}</p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-gray-600">
              暂无可判断选题。先生成问题池或完成 AI 实测，再决定今天发布什么。
            </p>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="question-operator-metrics">
          {metrics.map(metric => (
            <div key={metric.label} className="rounded-lg border border-white bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-gray-950">{metric.value}</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">{metric.hint}</p>
            </div>
          ))}
        </div>
      </P0Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="question-operator-scenarios">
          <div>
            <h2 className="text-base font-semibold text-gray-900">本月优先问题类型</h2>
            <p className="mt-1 text-xs text-gray-500">按业务场景判断选题价值，不让表格抢第一屏。</p>
          </div>
          <div className="mt-4 grid gap-3">
            {scenarios.map(scenario => (
              <div key={scenario.key} className="rounded-lg border border-gray-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{scenario.label}</p>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                    覆盖 {scenario.count} 条
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-3">
                  <div>
                    <dt className="font-medium text-gray-900">AI 表现</dt>
                    <dd className="mt-1">{scenario.aiPerformance}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-900">内容覆盖</dt>
                    <dd className="mt-1">{scenario.contentCoverage}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-900">建议动作</dt>
                    <dd className="mt-1">{scenario.nextAction}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="question-operator-top-items">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Top 优化问题</h2>
            <p className="mt-1 text-xs text-gray-500">最多展示 5 个最值得推进的问题。</p>
          </div>
          <div className="mt-4 divide-y divide-gray-100">
            {topItems.length > 0 ? (
              topItems.map(item => (
                <div key={item.key} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="max-w-2xl text-sm font-semibold leading-6 text-gray-950">{item.questionText}</p>
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                      {item.badgeLabel}
                    </Badge>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-gray-600 md:grid-cols-3">
                    <p><span className="font-medium text-gray-900">当前 AI 表现：</span>{item.aiPerformance}</p>
                    <p><span className="font-medium text-gray-900">内容任务：</span>{item.contentStatus}</p>
                    <p><span className="font-medium text-gray-900">下一步：</span>{item.nextAction}</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-500">为什么重要：{item.reason}</p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                暂无足够问题数据。建议先生成 AI 搜索问题池，再结合诊断和内容任务判断优先级。
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="question-operator-task-links">
        <div>
          <h2 className="text-base font-semibold text-gray-900">内容任务关联</h2>
          <p className="mt-1 text-xs text-gray-500">看哪些问题已进入内容、发布和复测链路。</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {taskLinks.map(item => (
            <div key={item.key} className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500">{item.label}</p>
              <p className="mt-2 text-xl font-semibold text-gray-950">{item.value}</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">{item.hint}</p>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
