import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  formatComparisonChangeLabel,
  formatRateDelta,
  formatRatePercent,
} from "@shared/testRoundComparison";
import { trpc } from "@/lib/trpc";
import { toUserFacingQueryError } from "@shared/userFacingErrors";

const PLATFORM_LABELS: Record<string, string> = {
  doubao: "豆包",
  deepseek: "DeepSeek",
  kimi: "Kimi",
  qwen: "通义千问",
  wenxin: "文心一言",
};

function resolvePlatformLabel(platform: string): string {
  const key = platform.trim().toLowerCase();
  return PLATFORM_LABELS[key] ?? platform;
}

function boolLabel(value: boolean): string {
  return value ? "是" : "否";
}

export function TestComparisonPanel(props: { projectId: number | null; enabled: boolean }) {
  const { projectId, enabled } = props;
  const roundsQuery = trpc.geo.testComparison.listComparableRounds.useQuery(
    { projectId: projectId! },
    { enabled: enabled && Boolean(projectId) },
  );
  const rounds = roundsQuery.data ?? [];
  const [roundAId, setRoundAId] = useState<string>("");
  const [roundBId, setRoundBId] = useState<string>("");

  const effectiveRoundA = roundAId || rounds[1]?.id || rounds[0]?.id || "";
  const effectiveRoundB = roundBId || rounds[0]?.id || "";

  const compareQuery = trpc.geo.testComparison.compare.useQuery(
    {
      projectId: projectId!,
      roundAId: effectiveRoundA,
      roundBId: effectiveRoundB,
    },
    {
      enabled:
        enabled &&
        Boolean(projectId && effectiveRoundA && effectiveRoundB && effectiveRoundA !== effectiveRoundB),
    },
  );

  const comparison = compareQuery.data;
  const previewRows = useMemo(() => (comparison?.rows ?? []).slice(0, 20), [comparison?.rows]);

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      data-testid="ai-diagnosis-test-comparison"
    >
      <p className="text-sm font-semibold text-gray-900">实测对比</p>
      <p className="mt-1 text-sm text-gray-600">选择两个已完成轮次，对比提及率、推荐率与竞品出现率变化。</p>

      {rounds.length < 2 ? (
        <p className="mt-4 text-sm text-gray-500">至少需要两次已完成实测才能对比。</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm text-gray-700">
              对比轮次 A（基准）
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={effectiveRoundA}
                onChange={event => setRoundAId(event.target.value)}
                data-testid="test-comparison-round-a"
              >
                {rounds.map(round => (
                  <option key={round.id} value={round.id}>
                    {round.roundName} ({round.finishedAt ? new Date(round.finishedAt).toLocaleDateString("zh-CN") : "—"})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-700">
              对比轮次 B（当前）
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={effectiveRoundB}
                onChange={event => setRoundBId(event.target.value)}
                data-testid="test-comparison-round-b"
              >
                {rounds.map(round => (
                  <option key={round.id} value={round.id}>
                    {round.roundName} ({round.finishedAt ? new Date(round.finishedAt).toLocaleDateString("zh-CN") : "—"})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {compareQuery.isLoading ? (
            <p className="mt-4 text-sm text-gray-500">正在计算对比结果…</p>
          ) : compareQuery.error ? (
            <p className="mt-4 text-sm text-red-700">
              {toUserFacingQueryError(compareQuery.error.message, "对比计算失败")}
            </p>
          ) : comparison ? (
            <>
              <div
                className="mt-4 grid gap-3 sm:grid-cols-3"
                data-testid="test-comparison-rate-summary"
              >
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">提及率变化</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    A {formatRatePercent(comparison.summaryA.mentionRate)} → B{" "}
                    {formatRatePercent(comparison.summaryB.mentionRate)}（
                    {formatRateDelta(comparison.mentionRateDelta)}）
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">推荐率变化</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    A {formatRatePercent(comparison.summaryA.recommendRate)} → B{" "}
                    {formatRatePercent(comparison.summaryB.recommendRate)}（
                    {formatRateDelta(comparison.recommendRateDelta)}）
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">竞品出现率变化</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    A {formatRatePercent(comparison.summaryA.competitorRate)} → B{" "}
                    {formatRatePercent(comparison.summaryB.competitorRate)}（
                    {formatRateDelta(comparison.competitorRateDelta)}）
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm" data-testid="test-comparison-table">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500">
                      <th className="px-2 py-2">问题</th>
                      <th className="px-2 py-2">平台</th>
                      <th className="px-2 py-2">轮次A 提及</th>
                      <th className="px-2 py-2">轮次A 推荐</th>
                      <th className="px-2 py-2">轮次A 竞品</th>
                      <th className="px-2 py-2">轮次B 提及</th>
                      <th className="px-2 py-2">轮次B 推荐</th>
                      <th className="px-2 py-2">轮次B 竞品</th>
                      <th className="px-2 py-2">变化</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map(row => (
                      <tr key={`${row.questionId}-${row.platform}`} className="border-b border-gray-100">
                        <td className="max-w-xs truncate px-2 py-2">{row.questionText}</td>
                        <td className="px-2 py-2">{resolvePlatformLabel(row.platform)}</td>
                        <td className="px-2 py-2">{boolLabel(row.roundA.mentioned)}</td>
                        <td className="px-2 py-2">{boolLabel(row.roundA.recommended)}</td>
                        <td className="px-2 py-2">{row.roundA.competitors.join("、") || "—"}</td>
                        <td className="px-2 py-2">{boolLabel(row.roundB.mentioned)}</td>
                        <td className="px-2 py-2">{boolLabel(row.roundB.recommended)}</td>
                        <td className="px-2 py-2">{row.roundB.competitors.join("、") || "—"}</td>
                        <td className="px-2 py-2">{formatComparisonChangeLabel(row.change)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(comparison.rows.length ?? 0) > previewRows.length ? (
                <p className="mt-2 text-xs text-gray-500">仅展示前 {previewRows.length} 条，共 {comparison.rows.length} 条。</p>
              ) : null}
            </>
          ) : effectiveRoundA === effectiveRoundB ? (
            <p className="mt-4 text-sm text-amber-700">请选择两个不同的轮次进行对比。</p>
          ) : null}
        </>
      )}

      <Button
        type="button"
        variant="outline"
        className="mt-4"
        disabled={roundsQuery.isFetching}
        onClick={() => void roundsQuery.refetch()}
        data-testid="test-comparison-refresh"
      >
        刷新轮次列表
      </Button>
    </div>
  );
}
