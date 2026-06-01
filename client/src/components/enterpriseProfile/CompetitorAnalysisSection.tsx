import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import {
  COMPETITOR_CONTENT_PLATFORMS,
  serializeCompetitorContentAssets,
  type CompetitorPlatformKey,
} from "@shared/competitorContentPlatforms";
import { listActivePlatformLabels } from "@shared/competitorAnalysisDisplay";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  projectId: number;
  brandName: string;
};

type PlatformDraft = Partial<Record<CompetitorPlatformKey, boolean>>;

type CompetitorDraft = {
  id: number;
  competitorName: string;
  platforms: PlatformDraft;
  note: string;
};

function optionalField(value: string | null | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function CompetitorAnalysisSection({ projectId, brandName }: Props) {
  const utils = trpc.useUtils();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [drafts, setDrafts] = useState<CompetitorDraft[]>([]);

  const summaryQuery = trpc.geo.assetLibrary.competitorAnalysisSummary.useQuery(
    { projectId },
    { enabled: Boolean(projectId) },
  );
  const assetSummaryQuery = trpc.geo.assetLibrary.summary.useQuery({ projectId }, { enabled: Boolean(projectId) });
  const updateCompetitor = trpc.geo.assetLibrary.updateCompetitor.useMutation();

  useEffect(() => {
    if (!summaryQuery.data) return;
    setDrafts(
      summaryQuery.data.competitors.map((row: { id: number; competitorName: string; platformDistribution: PlatformDraft; contentAssetsNote: string }) => ({
        id: row.id,
        competitorName: row.competitorName,
        platforms: { ...row.platformDistribution },
        note: row.contentAssetsNote,
      })),
    );
  }, [summaryQuery.data]);

  const saving = updateCompetitor.isPending;
  const loading = summaryQuery.isLoading;

  const hasCompetitors = (summaryQuery.data?.competitors.length ?? 0) > 0;

  const sortedCompetitors = useMemo(() => {
    const rows = summaryQuery.data?.competitors ?? [];
    return [...rows].sort((a, b) => b.aiMentionCount - a.aiMentionCount || a.competitorName.localeCompare(b.competitorName, "zh-CN"));
  }, [summaryQuery.data?.competitors]);

  function updateDraft(id: number, patch: Partial<Pick<CompetitorDraft, "platforms" | "note">>) {
    setDrafts(prev =>
      prev.map(row =>
        row.id === id
          ? {
              ...row,
              ...patch,
              platforms: patch.platforms ? { ...row.platforms, ...patch.platforms } : row.platforms,
            }
          : row,
      ),
    );
  }

  async function savePlatformDistribution(row: CompetitorDraft) {
    setMessage(undefined);
    setError(undefined);
    const profileRow = (assetSummaryQuery.data?.competitors ?? []).find(
      (item: { id?: number }) => item.id === row.id,
    ) as Record<string, unknown> | undefined;
    if (!profileRow) {
      setError("未找到竞品档案，请刷新后重试。");
      return;
    }

    try {
      await updateCompetitor.mutateAsync({
        projectId,
        id: row.id,
        competitorName: String(profileRow.competitorName ?? row.competitorName),
        website: optionalField(typeof profileRow.website === "string" ? profileRow.website : undefined),
        positioning: optionalField(typeof profileRow.positioning === "string" ? profileRow.positioning : undefined),
        strengths: optionalField(typeof profileRow.strengths === "string" ? profileRow.strengths : undefined),
        weaknesses: optionalField(typeof profileRow.weaknesses === "string" ? profileRow.weaknesses : undefined),
        priceInfo: optionalField(typeof profileRow.priceInfo === "string" ? profileRow.priceInfo : undefined),
        contentAssets: serializeCompetitorContentAssets({
          platforms: row.platforms,
          note: row.note,
        }),
        aiRecommendationSignals: optionalField(
          typeof profileRow.aiRecommendationSignals === "string" ? profileRow.aiRecommendationSignals : undefined,
        ),
        comparisonNotes: optionalField(typeof profileRow.comparisonNotes === "string" ? profileRow.comparisonNotes : undefined),
        sourceAssetIds: Array.isArray(profileRow.sourceAssetIds)
          ? profileRow.sourceAssetIds.filter((x): x is number => typeof x === "number")
          : [],
        canReference: profileRow.canReference === 1 || profileRow.canReference === true,
      });
      await Promise.all([
        utils.geo.assetLibrary.competitorAnalysisSummary.invalidate({ projectId }),
        utils.geo.assetLibrary.summary.invalidate({ projectId }),
      ]);
      setMessage(`${row.competitorName} 的公开内容分布已保存。`);
    } catch (e) {
      setError(toUserFacingErrorFromUnknown(e, "保存失败"));
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">正在加载竞品分析…</p>;
  }

  return (
    <section className="space-y-6" data-testid="competitor-analysis-section">
      <div className="geo-card p-5">
        <h2 className="text-base font-semibold text-gray-900">竞品内容资产对比</h2>
        <p className="mt-1 text-sm text-gray-500">
          汇总竞品档案与 AI 实测提及情况，帮助判断 {brandName || "本品牌"} 应优先补充哪些公开内容。
        </p>
        <p className="mt-2 text-xs text-gray-400">
          数据来源：竞品档案与 AI 实测诊断结果（共 {summaryQuery.data?.totalAiTestRuns ?? 0} 条实测记录）
        </p>
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</div>
      ) : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

      {!hasCompetitors ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          暂无竞品档案。请先在「品牌建档 → 高级素材 → 竞品差异」中填写竞品名称，或联系运营补充完整竞品资料。
        </div>
      ) : (
        <>
          <div className="geo-card overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900">竞品列表</h3>
              <p className="mt-1 text-xs text-gray-500">按 AI 提及频次排序；优势描述来自竞品档案。</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">竞品名称</th>
                    <th className="px-5 py-3 font-medium">AI 提及频次</th>
                    <th className="px-5 py-3 font-medium">相对 {brandName || "本品牌"} 的优势</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedCompetitors.map(row => (
                    <tr key={row.id} data-testid={`competitor-row-${row.id}`}>
                      <td className="px-5 py-4 font-medium text-gray-900">{row.competitorName}</td>
                      <td className="px-5 py-4 tabular-nums text-gray-700">
                        <span className={cn("font-semibold", row.aiMentionCount > 0 ? "text-amber-700" : "text-gray-400")}>
                          {row.aiMentionCount}
                        </span>
                        <span className="ml-1 text-xs text-gray-400">次</span>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{row.advantageDescription}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="geo-card p-5">
            <h3 className="text-sm font-semibold text-gray-900">竞品公开内容分布</h3>
            <p className="mt-1 text-xs text-gray-500">人工勾选各平台是否有公开内容，无需自动抓取。</p>
            <div className="mt-4 space-y-4">
              {drafts.map(row => (
                <div key={row.id} className="rounded-lg border border-gray-200 p-4" data-testid={`competitor-platforms-${row.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-gray-900">{row.competitorName}</p>
                    {listActivePlatformLabels(row.platforms).length > 0 ? (
                      <p className="text-xs text-gray-500">已有：{listActivePlatformLabels(row.platforms).join("、")}</p>
                    ) : (
                      <p className="text-xs text-gray-400">尚未标记平台分布</p>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {COMPETITOR_CONTENT_PLATFORMS.map(platform => (
                      <label key={platform.key} className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-gray-300"
                          checked={Boolean(row.platforms[platform.key])}
                          onChange={e =>
                            updateDraft(row.id, {
                              platforms: { [platform.key]: e.target.checked },
                            })
                          }
                        />
                        {platform.label}
                      </label>
                    ))}
                  </div>
                  <label className="mt-3 block space-y-1 text-sm">
                    <span className="text-gray-600">补充说明（可选）</span>
                    <Input
                      value={row.note}
                      onChange={e => updateDraft(row.id, { note: e.target.value })}
                      placeholder="如：官网案例较多、知乎专栏活跃等"
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    className={cn("mt-3", geoP0Brand.primary)}
                    disabled={saving}
                    onClick={() => void savePlatformDistribution(row)}
                  >
                    保存平台分布
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="geo-card p-5" data-testid="competitor-content-suggestions">
            <h3 className="text-sm font-semibold text-gray-900">建议补充的内容类型</h3>
            <p className="mt-1 text-xs text-gray-500">基于竞品 AI 提及频次与公开内容分布自动生成，供内容策略参考。</p>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              {(summaryQuery.data?.contentSuggestions ?? []).map((suggestion: string) => (
                <li key={suggestion} className="flex gap-2 rounded-lg bg-blue-50/60 px-3 py-2">
                  <span className="text-blue-600">·</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
