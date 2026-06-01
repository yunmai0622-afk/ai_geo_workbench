import { ArticleLifecyclePanel } from "@/components/ArticleLifecyclePanel";
import { GeoArticleQualityScoreDetailPopover } from "@/components/GeoArticleQualityScoreDetailPopover";
import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import { normalizeWeeklyPlatformKey } from "@/lib/weeklyPlatformBoard";
import type { GeoQualityCardView } from "@shared/geoQualityScoreDisplay";
import { shouldBlockPublishForGeoQuality } from "@shared/geoQualityStale";
import type { resolveArticleLifecycleView } from "@shared/articleLifecycle";
import type { GeoArticleQualityScoreRow } from "@shared/geoArticleQualityScoreDetail";
import type { ContentCardStatus } from "@shared/weeklyContentAssetsDisplay";
import { stripInternalArticleMetadataFromMarkdown } from "@shared/stripInternalArticleMetadata";
import { resolveXiaohongshuMaterial } from "@shared/xiaohongshuMaterial";
import { resolveWechatMaterial } from "@shared/wechatMaterial";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { XiaohongshuMaterialCard } from "@/components/weekly/XiaohongshuMaterialCard";
import { WechatMaterialCard } from "@/components/weekly/WechatMaterialCard";

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
  qualityView: GeoQualityCardView | null;
  qualityScore?: number | null;
  qualityScoreRow?: GeoArticleQualityScoreRow | null;
  qualityFailHints?: string[];
  qualityOptimizationSuggestions?: string[];
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

function articleBodyForCopy(article: Record<string, unknown>): string {
  const raw = article.markdownContent;
  if (typeof raw !== "string") return "";
  return stripInternalArticleMetadataFromMarkdown(raw).trim();
}

export function WeeklyPlatformArticleCard(props: Props) {
  const { model, disabled, selectable, selected, onSelectedChange, onView, onRegenerate, onEnqueuePublish } = props;
  const platformLabel = model.targetPlatform?.trim() || "待指定平台";
  const platformKey = model.platformKey ?? normalizeWeeklyPlatformKey(model.targetPlatform);
  const contentTypeLabel = model.contentTypeLabel?.trim() || "未标注";
  const xiaohongshuMaterial = useMemo(() => {
    if (platformKey !== "xiaohongshu") return null;
    const article = model.article;
    const materials =
      article.thirdPartyMaterials && typeof article.thirdPartyMaterials === "object"
        ? (article.thirdPartyMaterials as Record<string, string>)
        : {};
    const basis =
      article.generationBasis && typeof article.generationBasis === "object"
        ? (article.generationBasis as Record<string, unknown>)
        : null;
    const ps = basis?.platformContentStrategy as Record<string, unknown> | undefined;
    const keywords = Array.isArray(ps?.targetAiPlatforms)
      ? (ps.targetAiPlatforms as string[]).filter((x): x is string => typeof x === "string")
      : model.keywords;
    return resolveXiaohongshuMaterial({
      materialText: materials["小红书笔记版"],
      title: typeof article.title === "string" ? article.title : model.title,
      markdownContent:
        typeof article.markdownContent === "string"
          ? stripInternalArticleMetadataFromMarkdown(article.markdownContent)
          : "",
      keywords,
    });
  }, [platformKey, model.article, model.title, model.keywords]);
  const wechatMaterial = useMemo(() => {
    if (platformKey !== "wechat") return null;
    const article = model.article;
    const materials =
      article.thirdPartyMaterials && typeof article.thirdPartyMaterials === "object"
        ? (article.thirdPartyMaterials as Record<string, string>)
        : {};
    const basis =
      article.generationBasis && typeof article.generationBasis === "object"
        ? (article.generationBasis as Record<string, unknown>)
        : null;
    return resolveWechatMaterial({
      materialText: materials["公众号长文版"],
      title: typeof article.title === "string" ? article.title : model.title,
      markdownContent:
        typeof article.markdownContent === "string"
          ? stripInternalArticleMetadataFromMarkdown(article.markdownContent)
          : "",
      generationBasis: basis,
    });
  }, [platformKey, model.article, model.title]);
  const [bodyCopied, setBodyCopied] = useState(false);
  const bodyCopyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (bodyCopyTimerRef.current) clearTimeout(bodyCopyTimerRef.current);
    };
  }, []);

  const copyBody = async () => {
    const payload = articleBodyForCopy(model.article);
    if (!payload) {
      toast.error("正文为空，无法复制");
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      if (bodyCopyTimerRef.current) clearTimeout(bodyCopyTimerRef.current);
      setBodyCopied(true);
      bodyCopyTimerRef.current = setTimeout(() => setBodyCopied(false), 2000);
    } catch {
      toast.error("复制失败，请检查浏览器剪贴板权限");
    }
  };

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
      {model.qualityView ? (
        <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="weekly-card-quality">
          <span className="text-sm text-gray-600">质检分</span>
          <GeoArticleQualityScoreDetailPopover
            qualityRow={model.qualityScoreRow}
            testId={`weekly-card-quality-detail-${model.id}`}
          >
            <span className="text-sm font-semibold tabular-nums text-gray-900">{model.qualityView.score}</span>
          </GeoArticleQualityScoreDetailPopover>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${model.qualityView.tier.badgeClassName}`}
            data-testid="weekly-card-quality-tier"
          >
            {model.qualityView.tier.label}
          </span>
          {model.qualityView.staleLabel ? (
            <span className="text-xs text-amber-700">{model.qualityView.staleLabel}</span>
          ) : null}
        </div>
      ) : null}
      {model.qualityOptimizationSuggestions?.length ? (
        <div
          className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2"
          data-testid="weekly-card-quality-suggestions"
        >
          <p className="text-xs font-medium text-amber-900">优化建议</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-amber-900">
            {model.qualityOptimizationSuggestions.map(suggestion => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {model.qualityFailHints?.length ? (
        <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2" data-testid="weekly-card-quality-fail-hints">
          <p className="text-xs font-medium text-red-900">质检未通过</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-red-800">
            {model.qualityFailHints.map(hint => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {model.publishLink ? (
        <p className="mt-2 text-xs text-gray-600"><span className="font-medium text-gray-500">发布链接：</span>
          <a href={model.publishLink} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline-offset-2 hover:underline" data-testid="weekly-card-publish-link">查看已发布内容</a>
        </p>
      ) : null}
      {model.lifecycle ? <div className="mt-2"><ArticleLifecyclePanel articleId={model.id} article={model.article as Parameters<typeof ArticleLifecyclePanel>[0]["article"]} lifecycle={model.lifecycle} compact /></div> : null}
      {model.publishBlockHint ? <p className="mt-3 text-xs text-amber-800" data-testid="weekly-card-publish-readiness">{model.publishBlockHint}{model.publishNextActionLabel ? <span className="mt-1 block font-medium">下一步：{model.publishNextActionLabel}</span> : null}</p> : null}
      {xiaohongshuMaterial ? (
        <XiaohongshuMaterialCard className="mt-3" material={xiaohongshuMaterial} disabled={disabled} />
      ) : null}
      {wechatMaterial ? (
        <WechatMaterialCard className="mt-3" material={wechatMaterial} disabled={disabled} />
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        {platformKey !== "wechat" && platformKey !== "xiaohongshu" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            data-testid={`weekly-card-copy-body-${model.id}`}
            onClick={() => void copyBody()}
          >
            {bodyCopied ? "已复制" : "复制正文"}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" className={geoP0Brand.primaryOutline} onClick={onView}>查看</Button>
        <Button type="button" size="sm" variant="outline" className={geoP0Brand.primaryOutline} disabled={disabled} onClick={onRegenerate}>重新生成</Button>
        <Button type="button" size="sm" className={geoP0Brand.primary} disabled={disabled || shouldBlockPublishForGeoQuality(model.article as { geoQualityScore?: number | null; geoQualityRecommendation?: string | null; geoQualityStale?: boolean | number | null })} data-testid="weekly-enqueue-publish" onClick={onEnqueuePublish}>加入发布队列</Button>
      </div>
      <p className={`mt-2 ${geoP0Surfaces.muted}`}>平台 {platformKey} · 各平台独立稿件，不支持一稿多发</p>
    </P0Card>
  );
}
