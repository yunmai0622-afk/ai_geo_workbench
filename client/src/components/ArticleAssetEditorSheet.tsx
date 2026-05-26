import { ArticleLifecyclePanel } from "@/components/ArticleLifecyclePanel";
import { GeoQualityScore, type GeoQualityInitialState } from "@/components/GeoQualityScore";
import { type GeoQualityReviewResult } from "@shared/geoQualityReview";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";

import { renderArticleCoverPng } from "@/lib/renderArticleCoverPng";
import { trpc } from "@/lib/trpc";
import {
  ARTICLE_SAVED_PUBLISH_HINT_MESSAGE,
  buildArticleAssetSnapshot,
  isArticleAssetDraftDirty,
  type ArticleAssetDraftSnapshot,
} from "@shared/articleAssetDraft";
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
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [template, setTemplate] = useState<ArticleCoverTemplateId>("ai-tech");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverBase64Draft, setCoverBase64Draft] = useState<string | null>(null);
  const [coverGenerating, setCoverGenerating] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const savedSnapshot = useRef<ArticleAssetDraftSnapshot | null>(null);
  const [qualityInitial, setQualityInitial] = useState<GeoQualityInitialState | undefined>();
  const [contentStrategyType, setContentStrategyType] = useState<ContentAssetType | "">("");
  const [publishIdentity, setPublishIdentity] = useState<PublishIdentity | "">("");
  const [recommendedAccountGroup, setRecommendedAccountGroup] = useState<AccountGroupType | "">("");

  const buildQualityInitial = useCallback((a: EditableArticleAsset): GeoQualityInitialState => ({
    score: a.geoQualityScore,
    recommendation: a.geoQualityRecommendation,
    detail: (a.geoQualityDetail as GeoQualityReviewResult | null) ?? null,
    model: a.geoQualityModel,
    reviewedAt: a.geoQualityReviewedAt,
    stale: Boolean(a.geoQualityStale),
  }), []);

  const resetFromArticle = useCallback((a: EditableArticleAsset) => {
    setTitle(a.title ?? "");
    setContent(a.markdownContent ?? "");
    setTemplate(normalizeArticleCoverTemplateId(a.coverTemplate));
    setCoverPreview(coverPreviewFromFields(a.coverBase64, a.coverImageUrl));
    setCoverBase64Draft(a.coverBase64 ?? null);
    setCoverError(null);
    savedSnapshot.current = buildArticleAssetSnapshot({
      title: a.title,
      content: a.markdownContent,
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
    if (open && article) resetFromArticle(article);
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
      const msg = e instanceof Error ? e.message : "封面生成失败";
      setCoverError(msg);
      toast.error(msg);
    } finally {
      setCoverGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!article) return;
    if (!title.trim() || !content.trim()) {
      toast.error("标题和正文不能为空");
      return;
    }
    try {
      const saved = await updateArticle.mutateAsync({
        projectId,
        articleId: article.id,
        title: title.trim(),
        content: content.trim(),
        coverTemplate: template,
        coverBase64: coverBase64Draft,
        coverImageUrl: coverBase64Draft ? null : article.coverImageUrl,
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
        coverBase64: coverBase64Draft,
      });
      onDirtyChange?.(article.id, false);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col border-gray-200 bg-white text-gray-900 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>编辑内容资产</SheetTitle>
          <SheetDescription className="text-gray-500">
            修改标题、正文与封面模板后请保存；发布到平台将使用此处保存的最新内容。
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-1 py-2">
          {article ? (
            <ArticleLifecyclePanel articleId={article.id} article={article} lifecycle={article.lifecycle} />
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="asset-title">文章标题</Label>
            <input
              id="asset-title"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">内容策略</p>
              <p className="mt-1 text-xs text-gray-500">
                用于区分这篇内容适合用什么口吻、什么身份、哪类账号发布。
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-strategy-type">内容类型</Label>
              <select
                id="asset-strategy-type"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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

          <div className="space-y-2">
            <Label htmlFor="asset-content">文章正文</Label>
            <textarea
              id="asset-content"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 min-h-[220px] resize-y font-mono leading-relaxed"
              value={content}
              onChange={e => setContent(e.target.value)}
            />
          </div>

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
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                <img src={coverPreview} alt="封面预览" className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video items-center justify-center px-4 text-center text-sm text-gray-500">
                  {coverError ? "封面生成失败，可重试" : "待生成封面"}
                </div>
              )}
            </div>
            {isLegacyAiGeneratedCoverUrl(article?.coverImageUrl) && !coverBase64Draft ? (
              <p className="text-xs text-amber-600">检测到旧版 AI 生图封面，建议重新生成模板封面以避免乱码。</p>
            ) : null}
            {coverError ? <p className="text-xs text-amber-600">{coverError}</p> : null}
            <Button
              type="button"
              variant="outline"
              className="border-gray-200 text-gray-700 hover:bg-gray-50"
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
          <Button type="button" variant="outline" className="border-gray-200 text-gray-700 hover:bg-gray-50" onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={updateArticle.isPending} onClick={() => void handleSave()}>
            {updateArticle.isPending ? "保存中…" : "保存修改"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
