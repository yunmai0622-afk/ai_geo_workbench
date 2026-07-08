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
          <p className="text-xs font-semibold text-blue-700">今日优先问题 Top 3</p>
          {topItems.length > 0 ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {topItems.slice(0, 3).map(item => (
                <article key={item.key} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="outline" className="border-blue-200 bg-white text-blue-800">
                      {item.badgeLabel}
                    </Badge>
                    <span className="text-xs text-gray-500">{item.contentStatus}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold leading-6 text-gray-950">{item.questionText}</h3>
                  <p className="mt-2 text-xs leading-5 text-gray-600">
                    <span className="font-medium text-gray-800">为什么重要：</span>
                    {item.reason}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-600">
                    <span className="font-medium text-gray-800">推荐动作：</span>
                    {item.nextAction}
                  </p>
                </article>
              ))}
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

      <div className="grid gap-5">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="question-operator-scenarios">
          <div>
            <h2 className="text-base font-semibold text-gray-900">分类概览</h2>
            <p className="mt-1 text-xs text-gray-500">只看各类 AI 搜索问题数量，完整问题列表已折叠。</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {scenarios.map(scenario => (
              <div key={scenario.key} className="rounded-lg border border-gray-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{scenario.label}</p>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                    覆盖 {scenario.count} 条
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-gray-500">{scenario.nextAction}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="question-operator-task-links">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-gray-900">
          内容任务关联
          <span className="ml-2 text-xs font-normal text-gray-500">默认收起，避免把选题页变成任务看板</span>
        </summary>
        <div className="grid gap-3 border-t border-gray-100 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {taskLinks.map(item => (
            <div key={item.key} className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500">{item.label}</p>
              <p className="mt-2 text-xl font-semibold text-gray-950">{item.value}</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">{item.hint}</p>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
