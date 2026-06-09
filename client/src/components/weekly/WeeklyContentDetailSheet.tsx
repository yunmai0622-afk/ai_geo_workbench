import { GeoArticleQualityScoreDetailPopover } from "@/components/GeoArticleQualityScoreDetailPopover";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { geoP0Brand } from "@/lib/geoP0Visual";
import type { WeeklyArticleCardModel } from "@/components/weekly/WeeklyPlatformArticleCard";
import { stripInternalArticleMetadataFromMarkdown } from "@shared/stripInternalArticleMetadata";
import {
  resolveWeeklyAiQcDisplayStatus,
  resolveWeeklyEnqueueButtonKind,
  resolveWeeklyManualReviewDisplayStatus,
  weeklyEnqueueButtonLabel,
} from "@shared/weeklyPublishableDisplay";
import { contentReviewStatusBadgeClass } from "@shared/contentReviewStatus";
import { cn } from "@/lib/utils";
import { useRef } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: WeeklyArticleCardModel | null;
  disabled?: boolean;
  coverGenerating?: boolean;
  onSave: () => void;
  onMarkReviewed: () => void;
  onEnqueuePublish: () => void;
  onGenerateCover?: () => void;
  onUploadCover?: (file: File) => void;
  onGoPublishingPage?: () => void;
};

function articleBodyPreview(article: Record<string, unknown>): string {
  const raw = article.markdownContent;
  if (typeof raw !== "string") return "";
  return stripInternalArticleMetadataFromMarkdown(raw).trim();
}

function articleBodySummary(body: string, maxLen = 160): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= maxLen) return flat;
  return `${flat.slice(0, maxLen)}…`;
}

export function WeeklyContentDetailSheet({
  open,
  onOpenChange,
  model,
  disabled,
  coverGenerating,
  onSave,
  onMarkReviewed,
  onEnqueuePublish,
  onGenerateCover,
  onUploadCover,
  onGoPublishingPage,
}: Props) {
  const coverUploadInputRef = useRef<HTMLInputElement>(null);

  if (!model) return null;

  const body = articleBodyPreview(model.article);
  const summary = articleBodySummary(body);
  const aiQcStatus = resolveWeeklyAiQcDisplayStatus(model.article);
  const manualReviewStatus = resolveWeeklyManualReviewDisplayStatus(model.contentReviewStatus);
  const manualPending = manualReviewStatus === "未审核";
  const buttonKind = resolveWeeklyEnqueueButtonKind({
    published: model.statusFilterKey === "published",
    queued: model.queuedForPublish,
    aiQcStatus,
    manualReviewPending: manualPending,
    publishPreflightReady: model.publishPreflightReady,
  });
  const enqueueLabel = weeklyEnqueueButtonLabel(buttonKind);
  const enqueueDisabled =
    disabled ||
    buttonKind === "blocked_qc" ||
    buttonKind === "queued" ||
    buttonKind === "published";
  const coverMissing = !model.coverThumbnailSrc;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex w-full flex-col overflow-hidden sm:max-w-lg"
        data-testid="weekly-content-detail-sheet"
      >
        <SheetHeader>
          <SheetTitle className="pr-8 text-left text-lg leading-snug">{model.title}</SheetTitle>
          <SheetDescription className="text-left">
            发布平台：{model.targetPlatform?.trim() || "待指定平台"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          {model.coverThumbnailSrc ? (
            <div data-testid="weekly-detail-cover">
              <p className="text-xs font-medium text-gray-500">封面</p>
              <img
                src={model.coverThumbnailSrc}
                alt="内容封面"
                className="mt-2 max-h-40 rounded-lg border border-gray-200 object-cover"
              />
            </div>
          ) : (
            <div data-testid="weekly-detail-cover">
              <p className="text-xs font-medium text-gray-500">封面</p>
              <p className="mt-1 text-sm text-gray-600">未配置封面，生成或上传后可加入发布队列。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {onGenerateCover ? (
                  <Button
                    type="button"
                    size="sm"
                    className={geoP0Brand.primary}
                    disabled={disabled || coverGenerating}
                    data-testid="weekly-detail-generate-cover"
                    onClick={onGenerateCover}
                  >
                    {coverGenerating ? "正在生成封面…" : "生成封面图"}
                  </Button>
                ) : null}
                {onUploadCover ? (
                  <>
                    <input
                      ref={coverUploadInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      data-testid="weekly-detail-cover-upload-input"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) onUploadCover(file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={geoP0Brand.primaryOutline}
                      disabled={disabled || coverGenerating}
                      data-testid="weekly-detail-upload-cover"
                      onClick={() => coverUploadInputRef.current?.click()}
                    >
                      上传封面图
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          )}

          {summary ? (
            <div data-testid="weekly-detail-summary">
              <p className="text-xs font-medium text-gray-500">正文</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-700">{summary}</p>
            </div>
          ) : null}

          {body ? (
            <details className="rounded-lg border border-gray-200 bg-gray-50" data-testid="weekly-detail-full-body">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-800">
                展开全文
              </summary>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap border-t border-gray-200 px-4 py-3 text-xs leading-relaxed text-gray-800">
                {body}
              </pre>
            </details>
          ) : null}

          {model.strategySummary ? (
            <div data-testid="weekly-detail-platform-adaptation">
              <p className="text-xs font-medium text-gray-500">平台适配说明</p>
              <p className="mt-1 text-sm text-gray-700">{model.strategySummary}</p>
            </div>
          ) : null}

          {model.geoGap ? (
            <div data-testid="weekly-detail-geo-gap">
              <p className="text-xs font-medium text-gray-500">GEO 质量自检</p>
              <p className="mt-1 text-sm text-gray-700">{model.geoGap}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div data-testid="weekly-detail-ai-qc">
              <p className="text-xs font-medium text-gray-500">AI 质检结果</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-gray-800">{aiQcStatus}</span>
                {model.qualityView ? (
                  <GeoArticleQualityScoreDetailPopover
                    qualityRow={model.qualityScoreRow}
                    testId={`weekly-detail-quality-${model.id}`}
                  >
                    <span className="text-xs tabular-nums text-gray-600">
                      分 {model.qualityView.score}
                    </span>
                  </GeoArticleQualityScoreDetailPopover>
                ) : null}
              </div>
            </div>
            <div data-testid="weekly-detail-manual-review">
              <p className="text-xs font-medium text-gray-500">人工审核状态</p>
              <span
                className={cn(
                  "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                  contentReviewStatusBadgeClass(
                    manualReviewStatus === "已审核" ? "已审核可发布" : "待审核",
                  ),
                )}
              >
                {manualReviewStatus}
              </span>
            </div>
          </div>

          {model.publishBlockHint ? (
            <p className="text-sm text-amber-800" data-testid="weekly-detail-publish-hint">
              发布建议：{model.publishBlockHint}
            </p>
          ) : model.publishPreflightReady ? (
            <p className="text-sm text-emerald-800" data-testid="weekly-detail-publish-hint">
              发布建议：内容已通过发布前检查，可加入发布队列。
            </p>
          ) : null}
        </div>

        <SheetFooter className="shrink-0 flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-start">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            data-testid="weekly-detail-save"
            onClick={onSave}
          >
            保存修改
          </Button>
          {manualPending ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={geoP0Brand.primaryOutline}
              disabled={disabled}
              data-testid="weekly-detail-mark-reviewed"
              onClick={onMarkReviewed}
            >
              标记已审核
            </Button>
          ) : null}
          {model.queuedForPublish ? (
            <Button
              type="button"
              size="sm"
              className={geoP0Brand.primary}
              data-testid="weekly-detail-go-publishing"
              onClick={onGoPublishingPage}
            >
              去发布页查看
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className={geoP0Brand.primary}
              disabled={enqueueDisabled}
              data-testid="weekly-detail-enqueue"
              onClick={onEnqueuePublish}
            >
              {enqueueLabel}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
