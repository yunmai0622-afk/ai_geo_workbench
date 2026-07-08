import { Button } from "@/components/ui/button";
import { P0Card } from "@/components/geo/P0UiPrimitives";
import { geoP0Brand } from "@/lib/geoP0Visual";

export type SourceEvidenceMetric = {
  label: string;
  value: string;
  hint: string;
};

export type SourceEvidenceWeakness = {
  key: string;
  title: string;
  problem: string;
  impact: string;
  nextStep: string;
};

export type SourceEvidenceSuggestion = {
  key: string;
  title: string;
  action: string;
  priority: string;
};

export type SourceEvidenceDistribution = {
  key: string;
  label: string;
  count: number;
  hint: string;
};

export type SourceEvidenceConsistencyRow = {
  key: string;
  label: string;
  status: string;
  suggestion: string;
};

export type SourceEvidencePrimaryAction = {
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
};

type Props = {
  conclusion: string;
  metrics: SourceEvidenceMetric[];
  weaknesses: SourceEvidenceWeakness[];
  suggestions: SourceEvidenceSuggestion[];
  distribution: SourceEvidenceDistribution[];
  consistencyRows: SourceEvidenceConsistencyRow[];
  primaryAction: SourceEvidencePrimaryAction;
};

export function SourceEvidenceOperatorOverview({
  conclusion,
  metrics,
  weaknesses,
  suggestions,
  distribution,
  consistencyRows,
  primaryAction,
}: Props) {
  return (
    <section className="space-y-5" data-testid="source-evidence-operator-overview">
      <P0Card className="border-blue-100 bg-blue-50/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-blue-700">运营后台 · 信源证据与可信度修复</p>
            <h2 className="mt-2 text-xl font-bold text-gray-950">AI 为什么不够信任这个品牌</h2>
            <p className="mt-2 text-sm leading-6 text-gray-700">
              这里用于检查 AI 是否有足够公开证据信任品牌，并判断下步需要补哪些可信材料。
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-700" data-testid="source-evidence-operator-conclusion">
              {conclusion}
            </p>
          </div>
          <div className="shrink-0 rounded-lg border border-blue-100 bg-white p-3">
            <Button
              type="button"
              className={geoP0Brand.primary}
              disabled={primaryAction.disabled}
              onClick={primaryAction.onClick}
              data-testid="source-evidence-operator-primary-cta"
            >
              {primaryAction.label}
            </Button>
            <p className="mt-2 max-w-[15rem] text-xs leading-5 text-gray-500">{primaryAction.hint}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="source-evidence-operator-metrics">
          {metrics.map(metric => (
            <div key={metric.label} className="rounded-lg border border-white bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-gray-950">{metric.value}</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">{metric.hint}</p>
            </div>
          ))}
        </div>
      </P0Card>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="source-evidence-weaknesses">
          <div>
            <h2 className="text-base font-semibold text-gray-900">当前信源短板</h2>
            <p className="mt-1 text-xs text-gray-500">最多展示 3 个最影响 AI 识别和推荐的证据问题。</p>
          </div>
          <div className="mt-4 space-y-3">
            {weaknesses.length > 0 ? (
              weaknesses.map(item => (
                <div key={item.key} className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-950">{item.title}</p>
                  <p className="mt-1 text-xs text-amber-900">问题：{item.problem}</p>
                  <p className="mt-1 text-xs text-amber-800">影响：{item.impact}</p>
                  <p className="mt-1 text-xs text-amber-950">下一步：{item.nextStep}</p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                暂无明显信源短板。建议继续定期验证公开证据是否仍可访问、可引用。
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="source-evidence-suggestions">
          <div>
            <h2 className="text-base font-semibold text-gray-900">优先修复清单 Top 3</h2>
            <p className="mt-1 text-xs text-gray-500">把最影响 AI 信任的证据缺口转成运营动作。</p>
          </div>
          <div className="mt-4 space-y-3">
            {suggestions.length > 0 ? (
              suggestions.slice(0, 3).map(item => (
                <div key={item.key} className="rounded-lg border border-gray-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{item.priority}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-600">{item.action}</p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                暂无系统生成的信源修复建议。可先补充官网、平台主页、案例和公开内容。
              </div>
            )}
          </div>
        </section>
      </div>

      <details className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="source-evidence-summary-details">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-gray-900">
          信源分布与一致性摘要
          <span className="ml-2 text-xs font-normal text-gray-500">默认收起，完整字段在运营明细中处理</span>
        </summary>
        <div className="grid gap-5 border-t border-gray-100 p-5 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="source-evidence-distribution">
            <div>
              <h2 className="text-base font-semibold text-gray-900">信源类型分布</h2>
              <p className="mt-1 text-xs text-gray-500">按运营可理解的证据类型查看覆盖情况。</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {distribution.map(item => (
                <div key={item.key} className="rounded-lg border border-gray-100 p-4">
                  <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                  <p className="mt-2 text-xl font-semibold text-gray-950">{item.count} 条</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">{item.hint}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="source-evidence-consistency">
            <div>
              <h2 className="text-base font-semibold text-gray-900">一致性检查</h2>
              <p className="mt-1 text-xs text-gray-500">第一屏只展示关键判断，完整字段放到下方运营明细。</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {consistencyRows.map(row => (
                <div key={row.key} className="rounded-lg border border-gray-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{row.label}</p>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{row.status}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-500">{row.suggestion}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </details>
    </section>
  );
}
