import { ArticleLifecyclePanel } from "@/components/ArticleLifecyclePanel";
import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import { formatArticleStrategySummary } from "@shared/contentStrategy";
import { getGeoQualityLabel, type GeoQualityRecommendation } from "@shared/geoQualityReview";
import { isGeoQualityScoreStale, shouldBlockPublishForGeoQuality } from "@shared/geoQualityStale";
import { normalizeWeeklyPlatformKey } from "@/lib/weeklyPlatformBoard";
import type { resolveArticleLifecycleView } from "@shared/articleLifecycle";

export type WeeklyArticleCardModel = {
  id: number;
  title: string;
  targetPlatform?: string | null;
  contentGoal?: string | null;
  geoGap?: string | null;
  keywords?: string[];
  statusLabel: string;
  statusTone: "neutral" | "info" | "success" | "warning";
  qualityDisplay: string | null;
  strategySummary?: string | null;
  lifecycle?: ReturnType<typeof resolveArticleLifecycleView>;
  postPublish?: { pendingReview?: boolean; needsRewrite?: boolean };
  article: Record<string, unknown>;
};

type Props = {
  model: WeeklyArticleCardModel;
  disabled?: boolean;
  onView: () => void;
  onRegenerate: () => void;
  onEnqueuePublish: () => void;
};

export function WeeklyPlatformArticleCard({
  model,
  disabled,
  onView,
  onRegenerate,
  onEnqueuePublish,
}: Props) {
  const platformLabel = model.targetPlatform?.trim() || "待指定平台";
  const platformKey = normalizeWeeklyPlatformKey(model.targetPlatform);

  return (
    <P0Card testId={`weekly-content-card-${model.id}`} className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            model.statusTone === "success"
              ? "bg-emerald-100 text-emerald-800"
              : model.statusTone === "warning"
                ? "bg-amber-100 text-amber-800"
                : model.statusTone === "info"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-600"
          }`}
        >
          {model.statusLabel}
        </span>
        <span className="text-xs text-gray-500" data-testid="weekly-card-platform">
          {platformLabel}
        </span>
      </div>
      <h3 className="mt-2 line-clamp-2 text-base font-semibold text-gray-900">{model.title}</h3>
      {model.contentGoal ? (
        <p className="mt-2 text-xs text-gray-600">
          <span className="font-medium text-gray-500">内容目标：</span>
          {model.contentGoal}
        </p>
      ) : null}
      {model.geoGap ? (
        <p className="mt-1 text-xs text-gray-600" data-testid="weekly-card-geo-gap">
          <span className="font-medium text-gray-500">对应 GEO 缺口：</span>
          {model.geoGap}
        </p>
      ) : null}
      {model.keywords && model.keywords.length > 0 ? (
        <p className="mt-1 text-xs text-gray-600">
          <span className="font-medium text-gray-500">关键词：</span>
          {model.keywords.join("、")}
        </p>
      ) : null}
      {model.strategySummary ? (
        <p className="mt-2 text-xs text-gray-500" data-testid="article-strategy-summary">
          {model.strategySummary}
        </p>
      ) : null}
      {model.qualityDisplay ? (
        <p className="mt-2 text-sm text-gray-700" data-testid="weekly-card-quality">
          质检分：{model.qualityDisplay}
        </p>
      ) : null}
      {model.lifecycle ? (
        <div className="mt-2">
          <ArticleLifecyclePanel
            articleId={model.id}
            article={model.article as Parameters<typeof ArticleLifecyclePanel>[0]["article"]}
            lifecycle={model.lifecycle}
            compact
          />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        <Button type="button" size="sm" variant="outline" className={geoP0Brand.primaryOutline} onClick={onView}>
          查看
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={geoP0Brand.primaryOutline}
          disabled={disabled}
          onClick={onRegenerate}
        >
          重新生成
        </Button>
        <Button
          type="button"
          size="sm"
          className={geoP0Brand.primary}
          disabled={disabled || shouldBlockPublishForGeoQuality(model.article as { geoQualityScore?: number | null; geoQualityRecommendation?: string | null; geoQualityStale?: boolean | number | null })}
          data-testid="weekly-enqueue-publish"
          onClick={onEnqueuePublish}
        >
          加入发布队列
        </Button>
      </div>
      <p className={`mt-2 ${geoP0Surfaces.muted}`}>平台 {platformKey} · 各平台独立稿件，不支持一稿多发</p>
    </P0Card>
  );
}

/** 仅展示真实 GEO 质检分；无数据返回 null（卡片不展示假分） */
export function resolveQualityDisplay(article: {
  geoQualityScore?: number | null;
  geoQualityRecommendation?: string | null;
  geoQualityStale?: boolean | number | null;
}): string | null {
  if (article.geoQualityScore == null || !article.geoQualityRecommendation) return null;
  const label = getGeoQualityLabel(article.geoQualityRecommendation as GeoQualityRecommendation);
  const stale = isGeoQualityScoreStale(article) ? " · 待重新质检" : "";
  return `${article.geoQualityScore} 分 · ${label}${stale}`;
}
