import { ArticleContentEditMeta } from "@/components/ArticleContentEditMeta";
import { ArticleLifecyclePanel } from "@/components/ArticleLifecyclePanel";
import { GeoArticleQualityScoreDetailPopover } from "@/components/GeoArticleQualityScoreDetailPopover";
import { GeoQualityScore, type GeoQualityInitialState } from "@/components/GeoQualityScore";
import { type GeoQualityReviewResult } from "@shared/geoQualityReview";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { aiInput } from "@/lib/aiProductUi";
import { renderArticleCoverPng } from "@/lib/renderArticleCoverPng";
import { trpc } from "@/lib/trpc";
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
};

type ArticleAssetEditorSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  brandName: string;
  article: EditableArticleAsset | null;
  onSaved?: () => void;
  onDirtyChange?: (articleId: number, dirty: boolean) => void;
};

function coverPreviewFromFields(coverBase64?: string | null, coverImageUrl?: string | null): string | null {
  if (coverBase64?.trim()) {
    const raw = coverBase64.trim();
    return raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
  }
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
  onDirtyChange,
}: ArticleAssetEditorSheetProps) {
  const updateArticle = trpc.geo.articles.updateGeneratedArticle.useMutation();
  const qualityScoresQuery = trpc.geo.articles.latestQualityScores.useQuery(
    { projectId },
    { enabled: open && Boolean(article?.id) },
  );
  const articleQualityRow = useMemo(() => {
    if (!article?.id) return null;
    const rows = qualityScoresQuery.data ?? [];
    return rows.find(row => row.articleId === article.id) ?? null;
  }, [article?.id, qualityScoresQuery.data]);
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
  const [bodyCopied, setBodyCopied] = useState(false);
  const bodyCopyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
    const cleanedContent = stripInternalArticleMetadataFromMarkdown(a.markdownContent ?? "");
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

  const handleSave = async () => {
    if (!article || isSaving || updateArticle.isPending) return;
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
      const msg = toUserFacingErrorFromUnknown(e, "保存失败");
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
          <div className="space-y-2">
            <Label htmlFor="asset-title">文章标题</Label>
            <input
              id="asset-title"
              className={aiInput}
              value={title}
              onChange={e => setTitle(e.target.value)}
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
            <div className="space-y-2">
              <Label htmlFor="asset-strategy-type">内容类型</Label>
              <select
                id="asset-strategy-type"
                className={aiInput}
                value={contentStrategyType}
                onChange={e => setContentStrategyType(e.target.value as ContentAssetType | "")}
                data-testid="article-strategy-type"
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
            <XiaohongshuMaterialCard material={xiaohongshuMaterial} disabled={isSaving || updateArticle.isPending} />
          ) : null}

          {wechatMaterial ? (
            <WechatMaterialCard material={wechatMaterial} disabled={isSaving || updateArticle.isPending} />
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
            />
          </div>

          {article && articleQualityRow?.totalScore != null ? (
            <div
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
              data-testid="article-geo-quality-score-summary"
            >
              <p className="text-xs font-medium text-gray-500">内容 GEO 质检（质量检查记录）</p>
              <p className="mt-1">
                质检总分：
                <GeoArticleQualityScoreDetailPopover
                  qualityRow={articleQualityRow}
                  testId="article-editor-geo-quality-detail"
                >
                  <span className="font-semibold text-gray-900">{articleQualityRow.totalScore} 分</span>
                </GeoArticleQualityScoreDetailPopover>
                <span className="ml-2 text-xs text-gray-500">点击查看五项评分明细</span>
              </p>
            </div>
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
            />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="asset-template">封面模板</Label>
            <select
              id="asset-template"
              className={aiInput}
              value={template}
              onChange={e => setTemplate(normalizeArticleCoverTemplateId(e.target.value))}
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
              disabled={coverGenerating}
              onClick={() => void regenerateCover()}
            >
              {coverGenerating ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  正在生成封面…
                </>
              ) : (
                "重新生成封面"
              )}
            </Button>
          </div>
        </div>

        <SheetFooter className="border-t border-gray-200 pt-4">
          <Button type="button" variant="outline" className="border-gray-200" onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            variant="ai"
            disabled={isSaving || updateArticle.isPending}
            data-testid="article-asset-save-button"
            onClick={() => void handleSave()}
          >
            {isSaving || updateArticle.isPending ? "保存中…" : "保存修改"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
