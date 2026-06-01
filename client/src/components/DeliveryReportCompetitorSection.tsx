import {
  buildCompetitorPlatformMatrix,
  type DeliveryReportCompetitorComparison,
} from "@shared/deliveryReportCompetitor";
import { useMemo } from "react";

type Props = {
  data: DeliveryReportCompetitorComparison;
};

export function DeliveryReportCompetitorSection({ data }: Props) {
  const sortedCompetitors = useMemo(
    () =>
      [...data.competitors].sort(
        (a, b) => b.aiMentionCount - a.aiMentionCount || a.competitorName.localeCompare(b.competitorName, "zh-CN"),
      ),
    [data.competitors],
  );

  const platformMatrix = useMemo(() => buildCompetitorPlatformMatrix(sortedCompetitors), [sortedCompetitors]);

  const mentionRows = useMemo(
    () => [
      {
        name: data.brandName || "本品牌",
        count: data.brandAiMentionCount,
        isBrand: true,
        advantage: "—",
      },
      ...sortedCompetitors.map(row => ({
        name: row.competitorName,
        count: row.aiMentionCount,
        isBrand: false,
        advantage: row.advantageDescription,
      })),
    ],
    [data.brandName, data.brandAiMentionCount, sortedCompetitors],
  );

  const maxMention = Math.max(data.brandAiMentionCount, ...sortedCompetitors.map(row => row.aiMentionCount), 1);

  if (sortedCompetitors.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-sm text-gray-600"
        data-testid="delivery-report-competitor-empty"
      >
        暂无竞品档案。完成品牌建档并补充主要竞品后，可在此查看 AI 实测提及对比与内容分布建议。
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="delivery-report-competitor-section">
      <p className="text-xs text-gray-500">
        数据来源：竞品档案与 AI 实测诊断（共 {data.totalAiTestRuns} 条实测记录；竞品提及来自实测结果汇总）
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">AI 提及次数对比</h3>
        <p className="mt-1 text-xs text-gray-500">{data.brandName || "本品牌"} 与主要竞品在 AI 实测回答中被提及的次数。</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">名称</th>
                <th className="px-3 py-2 font-medium">AI 提及次数</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">相对优势（档案摘要）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mentionRows.map(row => (
                <tr key={row.name} data-testid={row.isBrand ? "delivery-report-competitor-brand-row" : undefined}>
                  <td className="px-3 py-3 font-medium text-gray-900">
                    {row.name}
                    {row.isBrand ? <span className="ml-2 text-xs font-normal text-sky-700">本品牌</span> : null}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums font-semibold text-gray-900">{row.count}</span>
                      <div className="h-2 min-w-[4rem] flex-1 max-w-[8rem] overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${row.isBrand ? "bg-sky-500" : "bg-amber-400"}`}
                          style={{ width: `${Math.max(8, Math.round((row.count / maxMention) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-3 text-gray-600 sm:table-cell">{row.advantage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">各平台竞品内容分布</h3>
        <p className="mt-1 text-xs text-gray-500">基于竞品档案中人工标记的公开内容平台，不代表自动抓取结果。</p>
        {platformMatrix.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">尚未标记竞品在各平台的内容分布，可在企业档案中补充。</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {platformMatrix.map(row => (
              <li
                key={row.platformLabel}
                className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-800"
                data-testid={`delivery-report-competitor-platform-${row.platformLabel}`}
              >
                <span className="font-medium text-gray-900">{row.platformLabel}</span>
                <span className="text-gray-600">：{row.competitorNames.join("、")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.contentSuggestions.length > 0 ? (
        <div
          className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4"
          data-testid="delivery-report-competitor-suggestions"
        >
          <h3 className="text-sm font-semibold text-gray-900">建议补充的内容方向</h3>
          <p className="mt-1 text-xs text-gray-500">针对竞品优势与公开内容分布，建议优先补齐以下类型内容。</p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-gray-800">
            {data.contentSuggestions.map(suggestion => (
              <li key={suggestion} className="flex gap-2">
                <span className="text-emerald-700">·</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
