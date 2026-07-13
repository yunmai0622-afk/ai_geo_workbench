import { ArticleGenerationHistoryPanel } from "@/components/ArticleGenerationHistoryPanel";
import { DangerousActionConfirmDialog } from "@/components/DangerousActionConfirmDialog";
import { useDangerousActionConfirm } from "@/hooks/useDangerousActionConfirm";
import { ArticleContentEditMeta } from "@/components/ArticleContentEditMeta";
import { ArticleLifecyclePanel } from "@/components/ArticleLifecyclePanel";
import { GeoQualityScore, type GeoQualityInitialState } from "@/components/GeoQualityScore";
import { type GeoQualityReviewResult, getGeoQualityLabel } from "@shared/geoQualityReview";
import { isContentQualityPassed } from "@shared/contentQualityGate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { aiInput } from "@/lib/aiProductUi";
import { renderArticleCoverPng } from "@/lib/renderArticleCoverPng";
import { trpc } from "@/lib/trpc";
import { mapArticleAssetSaveError } from "@shared/articleAssetSaveErrors";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import {
  ARTICLE_SAVED_PUBLISH_HINT_MESSAGE,
  buildArticleAssetSnapshot,
  isArticleAssetDraftDirty,
  type ArticleAssetDraftSnapshot,
} from "@shared/articleAssetDraft";
import { getArticlePublishPlatform } from "@shared/articlePublishPlatform";
import { stripInternalArticleMetadataFromMarkdown } from "@shared/stripInternalArticleMetadata";
import { resolveWechatMaterial } from "@shared/wechatMaterial";
import { WechatMaterialCard } from "@/components/weekly/WechatMaterialCard";
import {
  ACCOUNT_GROUP_OPTIONS,
  CONTENT_ASSET_TYPE_OPTIONS,
  defaultPublishIdentity,
  defaultRecommendedAccountGroup,
  inferContentStrategyFromArticleType,
  PUBLISH_IDENTITY_OPTIONS,
  type AccountGroupType,
  type ContentAssetType,
  type PublishIdentity,
} from "@shared/contentStrategy";
import { buildCoverDataUrlFromStored } from "@shared/articleCoverBase64";
import {
  ARTICLE_COVER_TEMPLATE_IDS,
  ARTICLE_COVER_TEMPLATE_LABELS,
  buildArticleCoverDataUrl,
  isLegacyAiGeneratedCoverUrl,
  normalizeArticleCoverTemplateId,
  type ArticleCoverTemplateId,
} from "@shared/articleCoverTemplate";
import { XiaohongshuMaterialCard } from "@/components/weekly/XiaohongshuMaterialCard";
import { resolveXiaohongshuMaterial } from "@shared/xiaohongshuMaterial";
import {
  CONTENT_TAG_PRESETS,
  formatContentTagsInput,
  normalizeContentTags,
  parseContentTagsInput,
} from "@shared/geoArticleContentTags";
import { DANGEROUS_ACTION_LABELS } from "@shared/dangerousActionConfirm";
import { isGeoQualityScoreStale } from "@shared/geoQualityStale";
import {
  CONTENT_NOT_GENERATED_EDIT_REASON,
  resolveArticleContentEditState,
} from "@shared/contentEditState";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export type EditableArticleAsset = {
  id: number;
  title?: string | null;
  markdownContent?: string | null;
  coverTemplate?: string | null;
  coverBase64?: string | null;
  coverImageUrl?: string | null;
  geoQualityScore?: number | null;
  geoQualityDetail?: GeoQualityReviewResult | Record<string, unknown> | null;
  geoQualityRecommendation?: string | null;
  geoQualityModel?: string | null;
  geoQualityReviewedAt?: string | Date | null;
  geoQualityStale?: boolean | number | null;
  contentStrategyType?: string | null;
  publishIdentity?: string | null;
  recommendedAccountGroup?: string | null;
  articleType?: string | null;
  lifecycleStatus?: string | null;
  lifecycleEvents?: unknown;
  status?: string | null;
  publicPath?: string | null;
  lifecycle?: Parameters<typeof ArticleLifecyclePanel>[0]["lifecycle"];
  contentEditedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  lastPublishRecordAt?: Date | string | null;
  thirdPartyMaterials?: Record<string, string> | null;
  generationBasis?: Record<string, unknown> | null;
  targetPlatform?: string | null;
  publishPlatform?: string | null;
  contentTags?: string[] | null;
};

type ArticleAssetEditorSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  brandName: string;
  article: EditableArticleAsset | null;
  onSaved?: () => void;
  onDeleted?: () => void;
  onDirtyChange?: (articleId: number, dirty: boolean) => void;
};

function coverPreviewFromFields(coverBase64?: string | null, coverImageUrl?: string | null): string | null {
  const fromStored = buildCoverDataUrlFromStored(coverBase64);
  if (fromStored) return fromStored;
  if (coverImageUrl?.trim()) return coverImageUrl.trim();
  return null;
}

export function ArticleAssetEditorSheet({
  open,
  onOpenChange,
  projectId,
  brandName,
  article,
  onSaved,
  onDeleted,
  onDirtyChange,
}: ArticleAssetEditorSheetProps) {
  const updateArticle = trpc.geo.articles.updateGeneratedArticle.useMutation();
  const deleteArticle = trpc.geo.articles.deleteContent.useMutation();
  const dangerousConfirm = useDangerousActionConfirm();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [template, setTemplate] = useState<ArticleCoverTemplateId>("ai-tech");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverBase64Draft, setCoverBase64Draft] = useState<string | null>(null);
  const [coverGenerating, setCoverGenerating] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const savedSnapshot = useRef<ArticleAssetDraftSnapshot | null>(null);
  const loadedArticleIdRef = useRef<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [qualityInitial, setQualityInitial] = useState<GeoQualityInitialState | undefined>();
  const [contentStrategyType, setContentStrategyType] = useState<ContentAssetType | "">("");
  const [publishIdentity, setPublishIdentity] = useState<PublishIdentity | "">("");
  const [recommendedAccountGroup, setRecommendedAccountGroup] = useState<AccountGroupType | "">("");
  const [contentTagsInput, setContentTagsInput] = useState("");
  const [bodyCopied, setBodyCopied] = useState(false);
  const bodyCopyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const articleEditState = useMemo(() => resolveArticleContentEditState(article), [article]);
  const canEditArticleContent = articleEditState.editable;

  const publishPlatformResolved = useMemo(
    () =>
      article
        ? getArticlePublishPlatform({
            targetPlatform: article.targetPlatform,
            publishPlatform: article.publishPlatform,
            generationBasis: article.generationBasis ?? null,
          })
        : null,
    [article],
  );
  const xiaohongshuMaterial = useMemo(() => {
    if (!article || publishPlatformResolved?.slug !== "xiaohongshu") return null;
    const materials = article.thirdPartyMaterials ?? {};
    const ps = article.generationBasis?.platformContentStrategy as Record<string, unknown> | undefined;
    const keywords = Array.isArray(ps?.targetAiPlatforms)
      ? (ps.targetAiPlatforms as string[]).filter((x): x is string => typeof x === "string")
      : [];
    return resolveXiaohongshuMaterial({
      materialText: materials["小红书笔记版"],
      title: title || article.title,
      markdownContent: content,
      keywords,
    });
  }, [article, content, title, publishPlatformResolved?.slug]);
  const wechatMaterial = useMemo(() => {
    if (!article || publishPlatformResolved?.slug !== "wechat") return null;
    const materials = article.thirdPartyMaterials ?? {};
    return resolveWechatMaterial({
      materialText: materials["公众号长文版"],
      title: title || article.title,
      markdownContent: content,
      generationBasis: article.generationBasis ?? null,
    });
  }, [article, content, title, publishPlatformResolved?.slug]);

  const buildQualityInitial = useCallback((a: EditableArticleAsset): GeoQualityInitialState => ({
    score: a.geoQualityScore,
    recommendation: a.geoQualityRecommendation,
    detail: (a.geoQualityDetail as GeoQualityReviewResult | null) ?? null,
    model: a.geoQualityModel,
    reviewedAt: a.geoQualityReviewedAt,
    stale: Boolean(a.geoQualityStale),
  }), []);

  const resetFromArticle = useCallback((a: EditableArticleAsset) => {
    const editState = resolveArticleContentEditState(a);
    const cleanedContent = editState.editable
      ? stripInternalArticleMetadataFromMarkdown(editState.body)
      : "";
    setTitle(a.title ?? "");
    setContent(cleanedContent);
    setTemplate(normalizeArticleCoverTemplateId(a.coverTemplate));
    setCoverPreview(coverPreviewFromFields(a.coverBase64, a.coverImageUrl));
    setCoverBase64Draft(a.coverBase64 ?? null);
    setCoverError(null);
    savedSnapshot.current = buildArticleAssetSnapshot({
      title: a.title,
      content: cleanedContent,
      coverTemplate: a.coverTemplate,
      coverBase64: a.coverBase64,
    });
    setQualityInitial(buildQualityInitial(a));
    setContentStrategyType((a.contentStrategyType as ContentAssetType) || inferContentStrategyFromArticleType(a.articleType) || "");
    setPublishIdentity((a.publishIdentity as PublishIdentity) || defaultPublishIdentity());
    setRecommendedAccountGroup(
      (a.recommendedAccountGroup as AccountGroupType) || defaultRecommendedAccountGroup(),
    );
    setContentTagsInput(formatContentTagsInput(normalizeContentTags(a.contentTags)));
  }, [buildQualityInitial]);

  useEffect(() => {
    return () => {
      if (bodyCopyTimerRef.current) clearTimeout(bodyCopyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      loadedArticleIdRef.current = null;
      setBodyCopied(false);
      return;
    }
    if (!article) return;
    if (loadedArticleIdRef.current === article.id) return;
    loadedArticleIdRef.current = article.id;
    resetFromArticle(article);
  }, [open, article, resetFromArticle]);

  useEffect(() => {
    if (!open || !title.trim()) return;
    setCoverPreview(
      buildArticleCoverDataUrl({
        template,
        title: title.trim(),
        brandName,
      }),
    );
  }, [open, template, title, brandName]);

  const isDirty = useMemo(() => {
    if (!article || !savedSnapshot.current) return false;
    const draft = buildArticleAssetSnapshot({
      title,
      content,
      coverTemplate: template,
      coverBase64: coverBase64Draft,
    });
    return isArticleAssetDraftDirty(savedSnapshot.current, draft);
  }, [article, title, content, template, coverBase64Draft]);

  useEffect(() => {
    if (!article || !open) return;
    onDirtyChange?.(article.id, isDirty);
  }, [article, open, isDirty, onDirtyChange]);

  const handleOpenChange = (next: boolean) => {
    if (!next && isDirty) {
      const ok = window.confirm("有未保存的修改，确定要离开吗？");
      if (!ok) return;
      if (article) onDirtyChange?.(article.id, false);
    }
    onOpenChange(next);
  };

  const regenerateCover = async () => {
    if (!title.trim()) {
      toast.error("请先填写文章标题");
      return;
    }
    setCoverGenerating(true);
    setCoverError(null);
    try {
      const { coverBase64, dataUrl } = await renderArticleCoverPng({
        template,
        title: title.trim(),
        brandName,
      });
      setCoverBase64Draft(coverBase64);
      setCoverPreview(dataUrl);
    } catch (e) {
      const msg = toUserFacingErrorFromUnknown(e, "封面生成失败");
      setCoverError(msg);
      toast.error(msg);
    } finally {
      setCoverGenerating(false);
    }
  };

  const generateCoverBase64ForSave = async (): Promise<{ coverBase64: string; dataUrl: string }> => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      throw new Error("请先填写文章标题");
    }
    const png = await renderArticleCoverPng({
      template,
      title: trimmedTitle,
      brandName,
    });
    if (!png.coverBase64?.trim()) {
      throw new Error("封面导出为空，请重试或点击「重新生成封面」");
    }
    return png;
  };

  const copyBodyToClipboard = async () => {
    if (!canEditArticleContent) {
      toast.error(articleEditState.reason ?? CONTENT_NOT_GENERATED_EDIT_REASON);
      return;
    }
    const payload = content.trim();
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

  const unifiedQualityScore = qualityInitial?.score ?? article?.geoQualityScore ?? null;
  const unifiedQualityRecommendation =
    (qualityInitial?.recommendation as GeoQualityReviewResult["recommendation"] | null | undefined) ??
    (article?.geoQualityRecommendation as GeoQualityReviewResult["recommendation"] | null | undefined) ??
    null;
  const unifiedQualityStale = Boolean(qualityInitial?.stale ?? article?.geoQualityStale);
  const unifiedQualityGateArticle = useMemo(() => {
    if (!article) return null;
    return {
      ...article,
      geoQualityScore: unifiedQualityScore,
      geoQualityRecommendation: unifiedQualityRecommendation,
      geoQualityStale: unifiedQualityStale,
    };
  }, [article, unifiedQualityRecommendation, unifiedQualityScore, unifiedQualityStale]);
  const unifiedQualityPassed =
    unifiedQualityGateArticle != null ? isContentQualityPassed(unifiedQualityGateArticle) : null;

  const handleSave = async () => {
    if (!article || isSaving || updateArticle.isPending) return;
    if (!canEditArticleContent) {
      toast.error(articleEditState.reason ?? CONTENT_NOT_GENERATED_EDIT_REASON);
      return;
    }
    if (!title.trim() || !content.trim()) {
      toast.error("标题和正文不能为空");
      return;
    }
    setIsSaving(true);
    setCoverError(null);
    try {
      const { coverBase64: coverBase64ToSave, dataUrl } = await generateCoverBase64ForSave();
      setCoverBase64Draft(coverBase64ToSave);
      setCoverPreview(dataUrl);
      const saved = await updateArticle.mutateAsync({
        projectId,
        articleId: article.id,
        title: title.trim(),
        content: content.trim(),
        coverTemplate: template,
        coverBase64: coverBase64ToSave,
        coverImageUrl: null,
        contentStrategyType: contentStrategyType || null,
        publishIdentity: publishIdentity || null,
        recommendedAccountGroup: recommendedAccountGroup || null,
        contentTags: parseContentTagsInput(contentTagsInput),
      });
      if (saved.article) {
        setQualityInitial(buildQualityInitial(saved.article as EditableArticleAsset));
      }
      toast.success(ARTICLE_SAVED_PUBLISH_HINT_MESSAGE);
      savedSnapshot.current = buildArticleAssetSnapshot({
        title,
        content,
        coverTemplate: template,
        coverBase64: coverBase64ToSave,
      });
      onDirtyChange?.(article.id, false);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      const msg = mapArticleAssetSaveError(e, "保存失败");
      if (msg.includes("封面")) {
        setCoverError(msg);
      }
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col border-gray-200 bg-white text-gray-900 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>编辑内容资产</SheetTitle>
          <SheetDescription className="text-gray-400">
            修改标题、正文与封面模板后请保存；发布到平台将使用此处保存的最新内容。
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-1 py-2">
          {article ? (
            <ArticleLifecyclePanel articleId={article.id} article={article} lifecycle={article.lifecycle} />
          ) : null}
          {article ? (
            <ArticleContentEditMeta
              contentEditedAt={article.contentEditedAt}
              updatedAt={article.updatedAt}
              lifecycleEvents={article.lifecycleEvents}
              lastPublishRecordAt={article.lastPublishRecordAt}
            />
          ) : null}
          {!canEditArticleContent ? (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
              data-testid="article-content-not-ready-hint"
            >
              <p className="font-medium">内容尚未生成完成，暂不能编辑</p>
              <p className="mt-1 text-xs leading-relaxed">
                {articleEditState.reason ?? CONTENT_NOT_GENERATED_EDIT_REASON}
              </p>
              <p className="mt-1 text-xs leading-relaxed">
                如果长时间停留在该状态，请返回内容任务卡重新生成内容。
              </p>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="asset-title">文章标题</Label>
            <input
              id="asset-title"
              className={aiInput}
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={!canEditArticleContent}
              maxLength={255}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/40 p-4">
            <div>
              <p className="text-sm font-medium text-white">内容策略</p>
              <p className="mt-1 text-xs text-gray-500">
                用于区分这篇内容适合用什么口吻、什么身份、哪类账号发布。
              </p>
            </div>
            <div className="space-y-2" data-testid="article-content-tags">
              <Label htmlFor="asset-content-tags">内容标签</Label>
              <p className="text-xs text-gray-500">用顿号或逗号分隔，最多 10 个；用于列表筛选与统计。</p>
              <input
                id="asset-content-tags"
                className={aiInput}
                value={contentTagsInput}
                onChange={e => setContentTagsInput(e.target.value)}
                placeholder="例如：主推产品、竞品对比"
                data-testid="article-content-tags-input"
                disabled={!canEditArticleContent}
              />
              <div className="flex flex-wrap gap-2">
                {CONTENT_TAG_PRESETS.map(preset => (
                  <Button
                    key={preset}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      const current = parseContentTagsInput(contentTagsInput);
                      if (current.some(t => t === preset)) return;
                      setContentTagsInput(formatContentTagsInput([...current, preset]));
                    }}
                    disabled={!canEditArticleContent}
                  >
                    + {preset}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-strategy-type">内容类型</Label>
              <select
                id="asset-strategy-type"
                className={aiInput}
                value={contentStrategyType}
                onChange={e => setContentStrategyType(e.target.value as ContentAssetType | "")}
                data-testid="article-strategy-type"
                disabled={!canEditArticleContent}
              >
                <option value="">未设置</option>
                {CONTENT_ASSET_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-publish-identity">发布身份</Label>
              <select
                id="asset-publish-identity"
                className={aiInput}
                value={publishIdentity}
                onChange={e => setPublishIdentity(e.target.value as PublishIdentity | "")}
                disabled={!canEditArticleContent}
              >
                {PUBLISH_IDENTITY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-account-group">推荐账号组</Label>
              <select
                id="asset-account-group"
                className={aiInput}
                value={recommendedAccountGroup}
                onChange={e => setRecommendedAccountGroup(e.target.value as AccountGroupType | "")}
                disabled={!canEditArticleContent}
              >
                {ACCOUNT_GROUP_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {xiaohongshuMaterial ? (
            <XiaohongshuMaterialCard material={xiaohongshuMaterial} disabled={isSaving || updateArticle.isPending || !canEditArticleContent} />
          ) : null}

          {wechatMaterial ? (
            <WechatMaterialCard material={wechatMaterial} disabled={isSaving || updateArticle.isPending || !canEditArticleContent} />
          ) : null}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="asset-content">文章正文</Label>
              {publishPlatformResolved?.slug !== "wechat" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-gray-200 text-gray-700"
                  data-testid="article-copy-body-button"
                  disabled={!canEditArticleContent}
                  onClick={() => void copyBodyToClipboard()}
                >
                  {bodyCopied ? "已复制" : "一键复制正文"}
                </Button>
              ) : null}
            </div>
            <textarea
              id="asset-content"
              className={`${aiInput} min-h-[220px] resize-y font-mono text-sm leading-relaxed`}
              value={content}
              onChange={e => setContent(e.target.value)}
              disabled={!canEditArticleContent}
              placeholder={canEditArticleContent ? undefined : CONTENT_NOT_GENERATED_EDIT_REASON}
            />
          </div>

          {article && unifiedQualityScore != null && unifiedQualityRecommendation ? (
            <div
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
              data-testid="article-geo-quality-score-summary"
            >
              <p className="text-xs font-medium text-gray-500">内容 GEO 质检（质量检查记录）</p>
              <p className="mt-1">
                质检总分：
                <span className="font-semibold text-gray-900">{unifiedQualityScore} 分</span>
                <span className="ml-2 text-xs text-gray-500">
                  {unifiedQualityStale
                    ? "待重新质检"
                    : getGeoQualityLabel(unifiedQualityRecommendation)}
                  {" · "}
                  {unifiedQualityPassed ? "质检通过" : "质检未通过"}
                </span>
              </p>
              {unifiedQualityStale ? (
                <p className="mt-2 text-xs text-amber-800">正文已修改，请重新进行发布前质检后再发布。</p>
              ) : null}
            </div>
          ) : null}

          {article ? (
            <ArticleGenerationHistoryPanel
              projectId={projectId}
              articleId={article.id}
              disabled={isSaving || updateArticle.isPending}
              onRestored={payload => {
                setTitle(payload.title);
                setContent(payload.markdownContent);
                onDirtyChange?.(article.id, true);
              }}
            />
          ) : null}

          {article ? (
            <GeoQualityScore
              articleId={article.id}
              projectId={projectId}
              initial={qualityInitial}
              onScoreLoaded={result => {
                setQualityInitial({
                  score: result.total,
                  recommendation: result.recommendation,
                  detail: result,
                  model: "deepseek",
                  stale: false,
                });
              }}
              disabled={!canEditArticleContent}
              disabledReason={articleEditState.reason}
            />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="asset-template">封面模板</Label>
            <select
              id="asset-template"
              className={aiInput}
              value={template}
              onChange={e => setTemplate(normalizeArticleCoverTemplateId(e.target.value))}
              disabled={!canEditArticleContent}
            >
              {ARTICLE_COVER_TEMPLATE_IDS.map(id => (
                <option key={id} value={id}>
                  {ARTICLE_COVER_TEMPLATE_LABELS[id]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>封面预览</Label>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              {coverPreview ? (
                <img src={coverPreview} alt="封面预览" loading="lazy" className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video items-center justify-center px-4 text-center text-sm text-gray-500">
                  {coverError ? "封面生成失败，可重试" : "待生成封面"}
                </div>
              )}
            </div>
            {isLegacyAiGeneratedCoverUrl(article?.coverImageUrl) && !coverBase64Draft ? (
              <p className="text-xs text-amber-200/90">检测到旧版 AI 生图封面，建议重新生成模板封面以避免乱码。</p>
            ) : null}
            {coverError ? <p className="text-xs text-amber-200">{coverError}</p> : null}
            <Button
              type="button"
              variant="outline"
              className="border-gray-200 text-gray-700"
              disabled={coverGenerating || !canEditArticleContent}
              onClick={() => void regenerateCover()}
              data-testid="article-asset-generate-cover-button"
            >
              {coverGenerating ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  正在生成封面…
                </>
              ) : coverBase64Draft || coverPreview ? (
                "重新生成封面"
              ) : (
                "生成封面图"
              )}
            </Button>
          </div>
        </div>

        <SheetFooter className="flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          {article ? (
            <Button
              type="button"
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50"
              disabled={isSaving || updateArticle.isPending || deleteArticle.isPending}
              data-testid="article-asset-delete-button"
              onClick={() =>
                dangerousConfirm.requestConfirm(DANGEROUS_ACTION_LABELS.deleteContent, async () => {
                  try {
                    await deleteArticle.mutateAsync({ projectId, articleId: article.id });
                    toast.success("内容已删除");
                    onDeleted?.();
                    handleOpenChange(false);
                  } catch (err) {
                    toast.error(toUserFacingErrorFromUnknown(err, "删除失败"));
                  }
                })
              }
            >
              删除内容
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="border-gray-200" onClick={() => handleOpenChange(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="ai"
              disabled={isSaving || updateArticle.isPending || deleteArticle.isPending || !canEditArticleContent}
              data-testid="article-asset-save-button"
              onClick={() => void handleSave()}
            >
              {isSaving || updateArticle.isPending ? "保存中…" : "保存修改"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
      <DangerousActionConfirmDialog {...dangerousConfirm.dialogProps} />
    </Sheet>
  );
}
