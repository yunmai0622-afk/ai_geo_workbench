import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import type { WeeklyArticleCardModel } from "@/components/weekly/WeeklyPlatformArticleCard";
import { stripInternalArticleMetadataFromMarkdown } from "@shared/stripInternalArticleMetadata";
import { useState } from "react";

type Props = {
  cards: WeeklyArticleCardModel[];
  onView: (model: WeeklyArticleCardModel) => void;
  onEdit?: (model: WeeklyArticleCardModel) => void;
};

function articleBodyPreview(article: Record<string, unknown>): string {
  const raw = article.markdownContent;
  if (typeof raw !== "string") return "";
  return stripInternalArticleMetadataFromMarkdown(raw).trim();
}

function articleBodySummary(body: string, maxLen = 180): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= maxLen) return flat;
  return `${flat.slice(0, maxLen)}…`;
}

function PreviewCard({
  model,
  onView,
  onEdit,
}: {
  model: WeeklyArticleCardModel;
  onView: (model: WeeklyArticleCardModel) => void;
  onEdit?: (model: WeeklyArticleCardModel) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const body = articleBodyPreview(model.article);
  const summary = articleBodySummary(body);
  const platformLabel = model.targetPlatform?.trim() || "待指定平台";

  return (
    <P0Card testId={`weekly-content-preview-${model.id}`} className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800" data-testid={`weekly-preview-platform-${model.id}`}>
          {platformLabel}
        </span>
        {model.contentTypeLabel ? <span className="text-xs text-gray-500">{model.contentTypeLabel}</span> : null}
      </div>
      <h3 className="mt-2 text-base font-semibold text-gray-900" data-testid={`weekly-preview-title-${model.id}`}>{model.title}</h3>
      {summary ? <p className="mt-2 text-sm leading-relaxed text-gray-700" data-testid={`weekly-preview-summary-${model.id}`}>{summary}</p> : null}
      {body && expanded ? <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs leading-relaxed text-gray-800" data-testid={`weekly-preview-full-body-${model.id}`}>{body}</pre> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {body ? <Button type="button" size="sm" variant="outline" className={geoP0Brand.primaryOutline} data-testid={`weekly-preview-expand-${model.id}`} onClick={() => setExpanded(v => !v)}>{expanded ? "收起全文" : "展开全文"}</Button> : null}
        {onEdit ? <Button type="button" size="sm" variant="outline" className={geoP0Brand.primaryOutline} data-testid={`weekly-preview-edit-${model.id}`} onClick={() => onEdit(model)}>编辑内容</Button> : null}
        <Button type="button" size="sm" variant="outline" className={geoP0Brand.primaryOutline} data-testid={`weekly-preview-view-${model.id}`} onClick={() => onView(model)}>查看详情</Button>
      </div>
    </P0Card>
  );
}

export function WeeklyContentPreviewPanel({ cards, onView, onEdit }: Props) {
  if (cards.length === 0) return null;
  const primary = cards[0]!;
  return (
    <section id="weekly-section-content-preview" className="scroll-mt-24 min-w-[600px] space-y-4" data-testid="weekly-content-preview-panel">
      <div className="space-y-1">
        <h2 className={geoP0Surfaces.sectionTitle}>内容预览</h2>
        <p className={geoP0Surfaces.muted}>优先查看当前主稿摘要，需要时再展开全文或进入编辑。</p>
      </div>
      <PreviewCard model={primary} onView={onView} onEdit={onEdit} />
    </section>
  );
}
