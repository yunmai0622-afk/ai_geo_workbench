import { P0Card, P0Section } from "@/components/geo/P0UiPrimitives";
import { Spinner } from "@/components/ui/spinner";
import { geoP0Surfaces } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import {
  RETEST_CONSERVATIVE_HINT,
  buildOverallChangeSummary,
  changeDirectionSymbol,
  formatOverallSummaryLines,
  resolvePlatformDisplayLabel,
  resolveQuestionTypeDisplayLabel,
  resolveT0T1ComparisonRows,
} from "@shared/retestComparisonDisplay";
import { useMemo } from "react";

type RetestComparisonPanelProps = {
  projectId: number;
  enabled: boolean;
};

export function RetestComparisonPanel({ projectId, enabled }: RetestComparisonPanelProps) {
  const comparisonsQuery = trpc.geo.retestComparisons.listByProject.useQuery(
    { projectId },
    { enabled },
  );
  const testRoundsQuery = trpc.geo.testRounds.list.useQuery({ projectId }, { enabled });

  const loading = comparisonsQuery.isLoading || testRoundsQuery.isLoading;

  const { baseRound, compareRound, rows, summaryLines } = useMemo(() => {
    const comparisons = comparisonsQuery.data ?? [];
    const rounds = testRoundsQuery.data ?? [];
    const resolved = resolveT0T1ComparisonRows(comparisons, rounds);
    const summary = buildOverallChangeSummary(resolved.rows, resolved.baseRound, resolved.compareRound);
    return {
      ...resolved,
      summaryLines: formatOverallSummaryLines(summary),
    };
  }, [comparisonsQuery.data, testRoundsQuery.data]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-gray-500" data-testid="retest-comparison-loading">
        <Spinner className="size-5 text-blue-600" />
        正在加载检测对比数据…
      </div>
    );
  }

  if (!baseRound || !compareRound) {
    return (
      <P0Card testId="retest-comparison-empty" className="text-sm text-gray-600">
        <p className="font-medium text-gray-900">暂无优化前基线与复测对比数据</p>
        <p className="mt-2 leading-relaxed text-gray-600">
          需先完成 AI 能见度诊断与 7天后复测，系统将自动生成对比结果。
        </p>
      </P0Card>
    );
  }

  if (rows.length === 0) {
    return (
      <P0Card testId="retest-comparison-no-rows" className="text-sm text-gray-600">
        <p className="font-medium text-gray-900">优化前检测与 7天后复测轮次已就绪，对比结果尚未生成</p>
        <p className="mt-2 leading-relaxed text-gray-600">
          基线：{baseRound.roundName} · 复测：{compareRound.roundName}。请等待系统完成对比计算。
        </p>
      </P0Card>
    );
  }

  return (
    <div className="space-y-8" data-testid="retest-comparison-panel">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-900">优化前基线 vs 7天后复测</h2>
        <p className="text-sm text-gray-500">
          基线：{baseRound.roundName} · 复测：{compareRound.roundName}
        </p>
      </header>

      <P0Section title="整体变化摘要" description="基于本轮优化前基线与复测对比样本汇总，供趋势参考。">
        <P0Card testId="retest-comparison-summary">
          <ul className="space-y-2 text-sm text-gray-800">
            <li>{summaryLines.mentionLine}</li>
            <li>{summaryLines.recommendLine}</li>
            <li>{summaryLines.competitorLine}</li>
          </ul>
        </P0Card>
      </P0Section>

      <P0Section title="分项对比" description="按问题类型与 AI 平台展示提及频次变化。">
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm" data-testid="retest-comparison-table">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-3">问题类型</th>
                <th className="px-4 py-3">平台</th>
                <th className="px-4 py-3">优化前提及次数</th>
                <th className="px-4 py-3">T1 提及次数</th>
                <th className="px-4 py-3">变化方向</th>
                <th className="px-4 py-3">系统判断</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {resolveQuestionTypeDisplayLabel(row.questionType)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{resolvePlatformDisplayLabel(row.platform)}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-700">{row.baseMentionCount}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-700">{row.compareMentionCount}</td>
                  <td className="px-4 py-3 text-lg leading-none text-gray-900">
                    {changeDirectionSymbol(row.changeDirection)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.systemConclusion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </P0Section>

      <P0Card testId="retest-comparison-hint" className="border-amber-100 bg-amber-50/60">
        <p className={geoP0Surfaces.muted}>{RETEST_CONSERVATIVE_HINT}</p>
      </P0Card>
    </div>
  );
}
