import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import {
  GEO_QUALITY_DIMENSION_META,
  GEO_QUALITY_DIMENSION_ORDER,
  getGeoQualityLabel,
  type GeoQualityRecommendation,
  type GeoQualityReviewResult,
} from "@shared/geoQualityReview";
import { GEO_QUALITY_STALE_EDITOR_HINT } from "@shared/geoQualityStale";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export type GeoQualityInitialState = {
  score?: number | null;
  recommendation?: string | null;
  detail?: GeoQualityReviewResult | null;
  model?: string | null;
  reviewedAt?: string | Date | null;
  stale?: boolean | null;
};

type GeoQualityScoreProps = {
  articleId: number;
  projectId: number;
  initial?: GeoQualityInitialState;
  onScoreLoaded?: (result: GeoQualityReviewResult, stale: boolean) => void;
  onRecommendationChange?: (recommendation: GeoQualityRecommendation | null, stale: boolean) => void;
  disabled?: boolean;
  disabledReason?: string | null;
};

function badgeClass(rec: GeoQualityRecommendation | null): string {
  if (rec === "publish") return "bg-emerald-500/15 text-emerald-200 border-emerald-400/30";
  if (rec === "revise") return "bg-amber-500/15 text-amber-100 border-amber-400/30";
  if (rec === "reject") return "bg-red-500/15 text-red-200 border-red-400/30";
  return "bg-gray-500/15 text-gray-600 border-gray-200";
}

function parseDetail(detail: unknown): GeoQualityReviewResult | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as GeoQualityReviewResult;
  if (d.scores && typeof d.total === "number" && d.recommendation) return d;
  return null;
}

function formatModelLabel(modelName: string): string {
  if (modelName === "deepseek") return "DeepSeek";
  return modelName;
}

export function GeoQualityScore({
  articleId,
  projectId,
  initial,
  onScoreLoaded,
  onRecommendationChange,
  disabled,
  disabledReason,
}: GeoQualityScoreProps) {
  const reviewMutation = trpc.geo.articles.contentQualityReview.useMutation();
  const [result, setResult] = useState<GeoQualityReviewResult | null>(() => parseDetail(initial?.detail));
  const [stale, setStale] = useState(() => Boolean(initial?.stale));
  const [modelName, setModelName] = useState(initial?.model ?? "DeepSeek");

  useEffect(() => {
    const parsed = parseDetail(initial?.detail);
    const nextStale = Boolean(initial?.stale);
    if (parsed) {
      setResult(parsed);
      setModelName(initial?.model ?? "DeepSeek");
      setStale(nextStale);
      onRecommendationChange?.(parsed.recommendation, nextStale);
    } else if (initial?.recommendation) {
      setStale(nextStale);
      onRecommendationChange?.(initial.recommendation as GeoQualityRecommendation, nextStale);
    } else {
      setResult(null);
      setStale(false);
      onRecommendationChange?.(null, false);
    }
  }, [initial?.detail, initial?.model, initial?.recommendation, initial?.stale, onRecommendationChange]);

  const displayTotal = result?.total ?? initial?.score ?? null;
  const displayRec =
    (result?.recommendation ?? (initial?.recommendation as GeoQualityRecommendation | null)) ?? null;
  const showStale = stale && displayTotal != null;

  const runReview = async () => {
    if (disabled) {
      toast.error(disabledReason || "当前内容暂不能质检");
      return;
    }
    try {
      const data = await reviewMutation.mutateAsync({ articleId, projectId });
      if (data.result) {
        setResult(data.result);
        setStale(false);
        setModelName(data.modelName ?? "deepseek");
        onScoreLoaded?.(data.result, false);
        onRecommendationChange?.(data.result.recommendation, false);
        toast.success(`质检完成：${data.result.total} 分 · ${getGeoQualityLabel(data.result.recommendation)}`);
      }
    } catch (e) {
      toast.error(toUserFacingErrorFromUnknown(e, "质检失败，请稍后重试"));
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-blue-200 bg-gray-50 p-4" data-testid="geo-quality-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-blue-700">GEO 发布前质检</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-blue-400/30 text-blue-700"
          disabled={reviewMutation.isPending || disabled}
          data-testid="geo-quality-review-btn"
          onClick={() => void runReview()}
        >
          {reviewMutation.isPending ? (
            <>
              <Spinner className="mr-2 size-4" />
              质检中...
            </>
          ) : displayTotal != null ? (
            "重新质检"
          ) : (
            "发布前质检"
          )}
        </Button>
      </div>

      {showStale ? (
        <p
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          data-testid="geo-quality-stale-hint"
        >
          {GEO_QUALITY_STALE_EDITOR_HINT}
        </p>
      ) : null}

      {displayTotal != null && displayRec ? (
        <div className="space-y-3" data-testid="geo-quality-result">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl font-bold text-gray-900" data-testid="geo-quality-total">
              {displayTotal}
              <span className="text-base font-normal text-gray-500"> / 100</span>
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${badgeClass(showStale ? null : displayRec)}`}
            >
              {showStale ? "待重新质检" : getGeoQualityLabel(displayRec)}
            </span>
          </div>

          {result && !showStale ? (
            <div className="space-y-3" data-testid="geo-quality-dimensions">
              {GEO_QUALITY_DIMENSION_ORDER.map(key => {
                const dim = result.scores[key];
                const pct = dim.max > 0 ? Math.round((dim.score / dim.max) * 100) : 0;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{GEO_QUALITY_DIMENSION_META[key]?.label ?? key}</span>
                      <span>
                        {dim.score} / {dim.max}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs leading-relaxed text-gray-500">{dim.reason}</p>
                  </div>
                );
              })}

              {result.suggestions.length > 0 ? (
                <div className="space-y-2 border-t border-gray-200 pt-3">
                  <p className="text-xs font-medium text-gray-600">优化建议</p>
                  <ul className="space-y-1 text-xs text-gray-400">
                    {result.suggestions.map((s, i) => (
                      <li key={i}>→ {s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.indexability ? (
                <div className="space-y-3 border-t border-gray-200 pt-3" data-testid="geo-indexability-result">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">GEO 收录友好度</p>
                      <p className="mt-0.5 text-xs text-gray-500">标题、首段、品牌实体、FAQ、摘要和信源的确定性检查</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${result.indexability.status === "通过" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {result.indexability.total} / 100 · {result.indexability.status}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {result.indexability.checks.map(check => (
                      <div key={check.key} className={`rounded-lg border px-3 py-2 ${check.passed ? "border-emerald-100 bg-emerald-50/60" : "border-amber-100 bg-amber-50/70"}`}>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-gray-800">{check.label}</span>
                          <span className={check.passed ? "text-emerald-700" : "text-amber-700"}>{check.passed ? "通过" : "需优化"}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-gray-600">{check.reason}</p>
                        {!check.passed ? <p className="mt-1 text-xs leading-5 text-amber-800">建议：{check.suggestion}</p> : null}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs leading-5 text-gray-500">{result.indexability.disclaimer}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <p className="text-xs text-gray-500" data-testid="geo-quality-model-hint">
            质检模型：{formatModelLabel(modelName)} · 仅供参考，以发布后实测结果为准
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-500">尚未进行发布前质检，建议填写并保存正文后点击「发布前质检」。</p>
      )}
    </div>
  );
}
