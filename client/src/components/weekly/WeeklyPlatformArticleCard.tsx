import { ArticleLifecyclePanel } from "@/components/ArticleLifecyclePanel";
import { GeoArticleQualityScoreDetailPopover } from "@/components/GeoArticleQualityScoreDetailPopover";
import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CONTENT_REVIEW_STATUSES,
  contentReviewStatusBadgeClass,
  type ContentReviewStatus,
} from "@shared/contentReviewStatus";
import { geoP0Brand } from "@/lib/geoP0Visual";
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
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
  gapLinkDisplay?: string | null;
  questionMentionRateChange?: {
    summaryLine: string;
    hasData: boolean;
  } | null;
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
  publishedAtLabel?: string | null;
  strategySummary?: string | null;
  lifecycle?: ReturnType<typeof resolveArticleLifecycleView>;
  postPublish?: { pendingReview?: boolean; needsRewrite?: boolean };
  article: Record<string, unknown>;
  publishBlockHint?: string | null;
  publishNextActionLabel?: string | null;
  publishPreflightReady?: boolean;
  queuedForPublish?: boolean;
  queuedStatusLabel?: string | null;
  contentReviewStatus: ContentReviewStatus;
  contentTags?: string[] | null;
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
  onGoPublishingPage?: () => void;
  onContentReviewStatusChange?: (status: ContentReviewStatus) => void;
};

function articleBodyForCopy(article: Record<string, unknown>): string {
  const raw = article.markdownContent;
  if (typeof raw !== "string") return "";
  return stripInternalArticleMetadataFromMarkdown(raw).trim();
}

export function WeeklyPlatformArticleCard(props: Props) {
  const {
    model,
    disabled,
    selectable,
    selected,
    onSelectedChange,
    onView,
    onRegenerate,
    onEnqueuePublish,
    onGoPublishingPage,
    onContentReviewStatusChange,
  } = props;
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
  const [expanded, setExpanded] = useState(false);
  const bodyCopyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (bodyCopyTimerRef.current) clearTimeout(bodyCopyTimerRef.current);
    };
  }, []);

  const articleBody = articleBodyForCopy(model.article);

  const copyBody = async () => {
    if (!articleBody) {
      toast.error("正文为空，无法复制");
      return;
    }
    try {
      await navigator.clipboard.writeText(articleBody);
      if (bodyCopyTimerRef.current) clearTimeout(bodyCopyTimerRef.current);
      setBodyCopied(true);
      bodyCopyTimerRef.current = setTimeout(() => setBodyCopied(false), 2000);
    } catch {
      toast.error("复制失败，请检查浏览器剪贴板权限");
    }
  };

  const statusBadgeClass =
    model.statusTone === "success"
      ? "bg-emerald-100 text-emerald-800"
      : model.statusTone === "warning"
        ? "bg-amber-100 text-amber-800"
        : model.statusTone === "info"
          ? "bg-blue-100 text-blue-800"
          : "bg-gray-100 text-gray-600";

  return (
    <P0Card testId={`weekly-content-card-${model.id}`} className="flex flex-col">
      <div className="flex min-w-0 items-start gap-3">
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
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          data-testid={`weekly-card-expand-${model.id}`}
          onClick={() => setExpanded(prev => !prev)}
          aria-expanded={expanded}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass}`}
              data-testid="weekly-card-status"
            >
              {model.statusLabel}
            </span>
            <span
              className="inline-flex rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800"
              data-testid="weekly-card-platform"
            >
              {platformLabel}
            </span>
            {expanded ? (
              <span
                className="inline-flex rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800"
                data-testid="weekly-card-content-type"
              >
                {contentTypeLabel}
              </span>
            ) : null}
            <ChevronDown
              className={cn("ml-auto h-4 w-4 shrink-0 text-gray-400 transition-transform", expanded && "rotate-180")}
              aria-hidden
            />
          </div>
          <h3 className={cn("mt-2 font-semibold text-gray-900", expanded ? "line-clamp-2 text-base" : "line-clamp-1 text-sm")}>
            {model.title}
          </h3>
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-gray-100 pt-3">
          <div className="flex min-w-0 items-start gap-3">
            {model.coverThumbnailSrc ? (
              <img
                src={model.coverThumbnailSrc}
                alt=""
                className="h-16 w-12 shrink-0 rounded-md border border-gray-200 object-cover"
                data-testid="weekly-card-cover-thumbnail"
              />
            ) : (
              <div
                className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50 text-[10px] text-gray-400"
                data-testid="weekly-card-cover-placeholder"
              >
                无封面
              </div>
            )}
            <div className="min-w-0 flex-1">
              {model.contentTags?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5" data-testid="weekly-card-content-tags">
                  {model.contentTags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] text-violet-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="relative mt-3 min-h-0 flex-1">
            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {model.contentGoal ? <p className="text-xs text-gray-600"><span className="font-medium text-gray-500">内容目标：</span>{model.contentGoal}</p> : null}
            {model.gapLinkDisplay ? (
              <p className="text-xs text-gray-700" data-testid="weekly-card-gap-link">
                {model.gapLinkDisplay}
              </p>
            ) : model.geoGap ? (
              <p className="text-xs text-gray-600" data-testid="weekly-card-geo-gap">
                <span className="font-medium text-gray-500">对应 GEO 缺口：</span>
                {model.geoGap}
              </p>
            ) : null}
            {model.questionMentionRateChange?.summaryLine ? (
              <p className="text-xs text-blue-800" data-testid="weekly-card-mention-rate-change">
                {model.questionMentionRateChange.summaryLine}
              </p>
            ) : null}
            {model.keywords?.length ? <p className="line-clamp-2 text-xs text-gray-600"><span className="font-medium text-gray-500">关键词：</span>{model.keywords.join("、")}</p> : null}
            {model.strategySummary ? <p className="line-clamp-2 text-xs text-gray-500" data-testid="article-strategy-summary">{model.strategySummary}</p> : null}
            {model.qualityView ? (
              <div className="flex flex-wrap items-center gap-2" data-testid="weekly-card-quality">
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
            {articleBody ? (
              <pre
                className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs leading-relaxed text-gray-800"
                data-testid="weekly-card-full-body"
              >
                {articleBody}
              </pre>
            ) : null}
            <>
                {model.qualityOptimizationSuggestions?.length ? (
                  <div
                    className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2"
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
                  <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2" data-testid="weekly-card-quality-fail-hints">
                    <p className="text-xs font-medium text-red-900">质检未通过</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-red-800">
                      {model.qualityFailHints.map(hint => (
                        <li key={hint}>{hint}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {model.publishedAtLabel ? (
                  <p className="text-xs text-emerald-800" data-testid="weekly-card-published-at">
                    {model.publishedAtLabel}
                  </p>
                ) : null}
                {model.publishLink ? (
                  <p className="text-xs text-gray-600"><span className="font-medium text-gray-500">发布链接：</span>
                    <a href={model.publishLink} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline-offset-2 hover:underline" data-testid="weekly-card-publish-link">查看已发布内容</a>
                  </p>
                ) : null}
                {model.lifecycle ? <div><ArticleLifecyclePanel articleId={model.id} article={model.article as Parameters<typeof ArticleLifecyclePanel>[0]["article"]} lifecycle={model.lifecycle} compact /></div> : null}
                {model.publishBlockHint ? <p className="text-xs text-amber-800" data-testid="weekly-card-publish-readiness">{model.publishBlockHint}{model.publishNextActionLabel ? <span className="mt-1 block font-medium">下一步：{model.publishNextActionLabel}</span> : null}</p> : null}
                <div className="flex flex-wrap items-center gap-2" data-testid="weekly-card-content-review">
                  <span className="text-xs font-medium text-gray-500">审核状态</span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${contentReviewStatusBadgeClass(model.contentReviewStatus)}`}
                    data-testid="weekly-card-content-review-badge"
                  >
                    {model.contentReviewStatus}
                  </span>
                  <Select
                    value={model.contentReviewStatus}
                    disabled={disabled}
                    onValueChange={value => onContentReviewStatusChange?.(value as ContentReviewStatus)}
                  >
                    <SelectTrigger
                      className="h-8 w-[9.5rem] text-xs"
                      data-testid="weekly-card-content-review-status"
                      aria-label={`${model.title} 审核状态`}
                    >
                      <SelectValue placeholder="选择审核状态" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_REVIEW_STATUSES.map(status => (
                        <SelectItem key={status} value={status} className="text-xs">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {xiaohongshuMaterial ? (
                  <XiaohongshuMaterialCard material={xiaohongshuMaterial} disabled={disabled} />
                ) : null}
                {wechatMaterial ? (
                  <WechatMaterialCard material={wechatMaterial} disabled={disabled} />
                ) : null}
            </>
            </div>
          </div>
          <div className="mt-3 flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 pt-3" data-testid="weekly-card-actions">
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
        {model.queuedForPublish ? (
          <>
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">
              {model.queuedStatusLabel ?? "已加入发布队列"}
            </span>
            <Button
              type="button"
              size="sm"
              className={geoP0Brand.primary}
              data-testid="weekly-go-publishing-page"
              onClick={onGoPublishingPage}
            >
              去发布页查看
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" className={geoP0Brand.primary} disabled={disabled || model.publishPreflightReady === false || shouldBlockPublishForGeoQuality(model.article as { geoQualityScore?: number | null; geoQualityRecommendation?: string | null; geoQualityStale?: boolean | number | null })} data-testid="weekly-enqueue-publish" onClick={onEnqueuePublish}>加入发布队列</Button>
        )}
          </div>
        </div>
      ) : null}
    </P0Card>
  );
}
