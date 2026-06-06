import { GeoArticleQualityScoreDetailPopover } from "@/components/GeoArticleQualityScoreDetailPopover";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { geoP0Brand } from "@/lib/geoP0Visual";
import {
  WEEKLY_CONTENT_TASK_STATUS_BADGE_CLASS,
  weeklyContentTaskStatusLabel,
  type WeeklyContentTaskStatus,
} from "@shared/weeklyContentTaskStatus";
import type { WeeklyArticleCardModel } from "@/components/weekly/WeeklyPlatformArticleCard";
import { stripInternalArticleMetadataFromMarkdown } from "@shared/stripInternalArticleMetadata";
import { shouldBlockPublishForGeoQuality } from "@shared/geoQualityStale";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: WeeklyArticleCardModel | null;
  status: WeeklyContentTaskStatus | null;
  disabled?: boolean;
  onEdit: () => void;
  onRegenerate: () => void;
  onEnqueuePublish: () => void;
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
  status,
  disabled,
  onEdit,
  onRegenerate,
  onEnqueuePublish,
  onGoPublishingPage,
}: Props) {
  if (!model) return null;

  const body = articleBodyPreview(model.article);
  const summary = articleBodySummary(body);
  const statusKey = status ?? "DRAFT";
  const statusLabel = weeklyContentTaskStatusLabel(statusKey);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-lg"
        data-testid="weekly-content-detail-sheet"
      >
        <SheetHeader>
          <SheetTitle className="pr-8 text-left text-lg leading-snug">{model.title}</SheetTitle>
          <SheetDescription className="text-left">
            {model.targetPlatform?.trim() || "待指定平台"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                WEEKLY_CONTENT_TASK_STATUS_BADGE_CLASS[statusKey],
              )}
              data-testid="weekly-detail-status"
            >
              {statusLabel}
            </span>
            {model.qualityView ? (
              <GeoArticleQualityScoreDetailPopover
                qualityRow={model.qualityScoreRow}
                testId={`weekly-detail-quality-${model.id}`}
              >
                <span className="text-sm tabular-nums text-gray-700">
                  质检分 {model.qualityView.score}
                </span>
              </GeoArticleQualityScoreDetailPopover>
            ) : null}
          </div>

          {summary ? (
            <div data-testid="weekly-detail-summary">
              <p className="text-xs font-medium text-gray-500">正文摘要</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-700">{summary}</p>
            </div>
          ) : null}

          {model.geoGap ? (
            <div data-testid="weekly-detail-geo-gap">
              <p className="text-xs font-medium text-gray-500">对应 GEO 缺口</p>
              <p className="mt-1 text-sm text-gray-700">{model.geoGap}</p>
            </div>
          ) : null}

          {model.keywords?.length ? (
            <div data-testid="weekly-detail-keywords">
              <p className="text-xs font-medium text-gray-500">关键词</p>
              <p className="mt-1 text-sm text-gray-700">{model.keywords.join("、")}</p>
            </div>
          ) : null}

          {body ? (
            <details className="rounded-lg border border-gray-200 bg-gray-50" data-testid="weekly-detail-full-body">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-800">
                查看完整正文
              </summary>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap border-t border-gray-200 px-4 py-3 text-xs leading-relaxed text-gray-800">
                {body}
              </pre>
            </details>
          ) : null}

          {model.publishBlockHint ? (
            <p className="text-sm text-amber-800" data-testid="weekly-detail-publish-hint">
              发布建议：{model.publishBlockHint}
            </p>
          ) : model.publishPreflightReady ? (
            <p className="text-sm text-emerald-800" data-testid="weekly-detail-publish-hint">
              发布建议：内容已通过发布前检查，可加入发布队列。
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={geoP0Brand.primaryOutline}
              data-testid="weekly-detail-edit"
              onClick={onEdit}
            >
              编辑内容
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={geoP0Brand.primaryOutline}
              disabled={disabled}
              data-testid="weekly-detail-regenerate"
              onClick={onRegenerate}
            >
              重新生成
            </Button>
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
                disabled={
                  disabled ||
                  model.publishPreflightReady === false ||
                  shouldBlockPublishForGeoQuality(
                    model.article as {
                      geoQualityScore?: number | null;
                      geoQualityRecommendation?: string | null;
                      geoQualityStale?: boolean | number | null;
                    },
                  )
                }
                data-testid="weekly-detail-enqueue"
                onClick={onEnqueuePublish}
              >
                加入发布队列
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
