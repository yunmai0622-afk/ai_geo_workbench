import { ArticleLifecyclePanel } from "@/components/ArticleLifecyclePanel";
import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import { normalizeWeeklyPlatformKey } from "@/lib/weeklyPlatformBoard";
import { getGeoQualityLabel, type GeoQualityRecommendation } from "@shared/geoQualityReview";
import { isGeoQualityScoreStale, shouldBlockPublishForGeoQuality } from "@shared/geoQualityStale";
import type { resolveArticleLifecycleView } from "@shared/articleLifecycle";
import type { ContentCardStatus } from "@shared/weeklyContentAssetsDisplay";

export type WeeklyArticleCardModel = {
  id: number;
  title: string;
  targetPlatform?: string | null;
  platformKey?: string | null;
  contentTypeLabel?: string | null;
  contentGoal?: string | null;
  geoGap?: string | null;
  keywords?: string[];
  statusLabel: string;
  statusTone: "neutral" | "info" | "success" | "warning";
  statusFilterKey: ContentCardStatus;
  qualityDisplay: string | null;
  qualityScore?: number | null;
  coverThumbnailSrc?: string | null;
  publishLink?: string | null;
  strategySummary?: string | null;
  lifecycle?: ReturnType<typeof resolveArticleLifecycleView>;
  postPublish?: { pendingReview?: boolean; needsRewrite?: boolean };
  article: Record<string, unknown>;
  publishBlockHint?: string | null;
  publishNextActionLabel?: string | null;
};

type Props = {
  model: WeeklyArticleCardModel;
  disabled?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (checked: boolean) => void;
  onView: () => void;
  onRegenerate: () => void;
  onEnqueuePublish: () => void;
};

export function WeeklyPlatformArticleCard(props: Props) {
  const { model, disabled, selectable, selected, onSelectedChange, onView, onRegenerate, onEnqueuePublish } = props;
  const platformLabel = model.targetPlatform?.trim() || "待指定平台";
  const platformKey = model.platformKey ?? normalizeWeeklyPlatformKey(model.targetPlatform);
  const contentTypeLabel = model.contentTypeLabel?.trim() || "未标注";

  return (
    <P0Card testId={`weekly-content-card-${model.id}`} className="flex flex-col">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {selectable ? (
          <Checkbox
            checked={selected}
            disabled={disabled || model.statusFilterKey === "published"}
            data-testid={`weekly-card-select-${model.id}`}
            onCheckedChange={value => onSelectedChange?.(value === true)}
            aria-label={`选择 ${model.title}`}
            className="mt-1"
          />
        ) : null}
        {model.coverThumbnailSrc ? (
          <img src={model.coverThumbnailSrc} alt="" className="h-16 w-12 shrink-0 rounded-md border border-gray-200 object-cover" data-testid="weekly-card-cover-thumbnail" />
        ) : (
          <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50 text-[10px] text-gray-400" data-testid="weekly-card-cover-placeholder">无封面</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${model.statusTone === "success" ? "bg-emerald-100 text-emerald-800" : model.statusTone === "warning" ? "bg-amber-100 text-amber-800" : model.statusTone === "info" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"}`}>{model.statusLabel}</span>
            <span className="text-xs text-gray-500" data-testid="weekly-card-platform">{platformLabel}</span>
            <span className="text-xs text-gray-500" data-testid="weekly-card-content-type">{contentTypeLabel}</span>
          </div>
          <h3 className="mt-2 line-clamp-2 text-base font-semibold text-gray-900">{model.title}</h3>
        </div>
      </div>
      {model.contentGoal ? <p className="mt-2 text-xs text-gray-600"><span className="font-medium text-gray-500">内容目标：</span>{model.contentGoal}</p> : null}
      {model.geoGap ? <p className="mt-1 text-xs text-gray-600" data-testid="weekly-card-geo-gap"><span className="font-medium text-gray-500">对应 GEO 缺口：</span>{model.geoGap}</p> : null}
      {model.keywords?.length ? <p className="mt-1 text-xs text-gray-600"><span className="font-medium text-gray-500">关键词：</span>{model.keywords.join("、")}</p> : null}
      {model.strategySummary ? <p className="mt-2 text-xs text-gray-500" data-testid="article-strategy-summary">{model.strategySummary}</p> : null}
      {model.qualityDisplay ? <p className="mt-2 text-sm text-gray-700" data-testid="weekly-card-quality">质检分：{model.qualityDisplay}</p> : null}
      {model.publishLink ? (
        <p className="mt-2 text-xs text-gray-600"><span className="font-medium text-gray-500">发布链接：</span>
          <a href={model.publishLink} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline-offset-2 hover:underline" data-testid="weekly-card-publish-link">查看已发布内容</a>
        </p>
      ) : null}
      {model.lifecycle ? <div className="mt-2"><ArticleLifecyclePanel articleId={model.id} article={model.article as Parameters<typeof ArticleLifecyclePanel>[0]["article"]} lifecycle={model.lifecycle} compact /></div> : null}
      {model.publishBlockHint ? <p className="mt-3 text-xs text-amber-800" data-testid="weekly-card-publish-readiness">{model.publishBlockHint}{model.publishNextActionLabel ? <span className="mt-1 block font-medium">下一步：{model.publishNextActionLabel}</span> : null}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        <Button type="button" size="sm" variant="outline" className={geoP0Brand.primaryOutline} onClick={onView}>查看</Button>
        <Button type="button" size="sm" variant="outline" className={geoP0Brand.primaryOutline} disabled={disabled} onClick={onRegenerate}>重新生成</Button>
        <Button type="button" size="sm" className={geoP0Brand.primary} disabled={disabled || shouldBlockPublishForGeoQuality(model.article as { geoQualityScore?: number | null; geoQualityRecommendation?: string | null; geoQualityStale?: boolean | number | null })} data-testid="weekly-enqueue-publish" onClick={onEnqueuePublish}>加入发布队列</Button>
      </div>
      <p className={`mt-2 ${geoP0Surfaces.muted}`}>平台 {platformKey} · 各平台独立稿件，不支持一稿多发</p>
    </P0Card>
  );
}

export function resolveQualityDisplay(article: { geoQualityScore?: number | null; geoQualityRecommendation?: string | null; geoQualityStale?: boolean | number | null }): string | null {
  if (article.geoQualityScore == null || !article.geoQualityRecommendation) return null;
  const label = getGeoQualityLabel(article.geoQualityRecommendation as GeoQualityRecommendation);
  const stale = isGeoQualityScoreStale(article) ? " · 待重新质检" : "";
  return `${article.geoQualityScore} 分 · ${label}${stale}`;
}
