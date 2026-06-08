import { P0Card } from "@/components/geo/P0UiPrimitives";
import { PlatformContentGuidelineHelp } from "@/components/weekly/PlatformContentGuidelineHelp";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import {
  type PlatformContentCounts,
  type WeeklyPlatformDef,
  type WeeklyPlatformKey,
} from "@/lib/weeklyPlatformBoard";
import {
  WEEKLY_CONTENT_TASK_STATUS_BADGE_CLASS,
  weeklyContentTaskStatusLabel,
  type WeeklyContentTaskStatus,
} from "@shared/weeklyContentTaskStatus";
import { cn } from "@/lib/utils";

export type PlatformBoardRow = {
  def: WeeklyPlatformDef;
  counts: PlatformContentCounts;
  pendingReviewCount: number;
  queuedCount: number;
  lastGeneratedAtLabel?: string | null;
  lastPublishedAtLabel?: string | null;
  platformRole: string;
  platformGenerationGoal: string;
  publishHint: string;
  status: WeeklyContentTaskStatus;
  hasContent: boolean;
  articleId?: number | null;
};

type Props = {
  rows: PlatformBoardRow[];
  boardBusy?: boolean;
  generatingPlatformKey?: WeeklyPlatformKey | null;
  onGenerate: (key: WeeklyPlatformDef["key"]) => void;
  onView: (key: WeeklyPlatformDef["key"]) => void;
};

export function PlatformContentBoard({
  rows,
  boardBusy = false,
  generatingPlatformKey = null,
  onGenerate,
  onView,
}: Props) {
  return (
    <section
      id="weekly-section-platform-matrix"
      className="scroll-mt-24 space-y-4"
      data-testid="weekly-platform-board"
    >
      <div className="space-y-1">
        <h2 className={geoP0Surfaces.sectionTitle}>平台发布计划</h2>
        <p className={geoP0Surfaces.muted}>按平台查看待发布进度，生成并推进各平台内容。</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2" data-testid="weekly-platform-matrix-grid">
        {rows.map(
          ({
            def,
            counts,
            lastGeneratedAtLabel,
            lastPublishedAtLabel,
            status,
            hasContent,
          }) => {
            const pendingPublishCount = counts.ready;
            const statusLabel = weeklyContentTaskStatusLabel(status);
            const isGenerating = status === "GENERATING" || generatingPlatformKey === def.key;
            const recentPublishLabel = lastPublishedAtLabel ?? lastGeneratedAtLabel ?? "暂无";

            return (
              <P0Card key={def.key} testId={`weekly-platform-card-${def.key}`} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <h3 className="text-base font-semibold text-gray-900">{def.label}</h3>
                    <PlatformContentGuidelineHelp
                      platformLabel={def.label}
                      publishPlatformId={def.publishPlatformId}
                      testId={`platform-content-guideline-${def.key}`}
                    />
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      WEEKLY_CONTENT_TASK_STATUS_BADGE_CLASS[status],
                    )}
                    data-testid={`weekly-platform-status-${def.key}`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <dl className="mt-3 space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between gap-2">
                    <dt>待发布</dt>
                    <dd className="font-medium text-gray-800" data-testid={`weekly-platform-pending-${def.key}`}>
                      {pendingPublishCount}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>最近发布</dt>
                    <dd className="text-gray-700" data-testid={`weekly-platform-recent-${def.key}`}>
                      {recentPublishLabel}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-1 flex-col gap-2 border-t border-gray-100 pt-4">
                  <Button
                    type="button"
                    size="sm"
                    className={geoP0Brand.primary}
                    disabled={boardBusy || isGenerating}
                    data-testid={`weekly-generate-${def.key}`}
                    onClick={() => onGenerate(def.key)}
                  >
                    {isGenerating ? "生成中…" : "生成该平台内容"}
                  </Button>
                  {hasContent ? (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-xs font-medium text-gray-500">更多操作</summary>
                      <div className="mt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={geoP0Brand.primaryOutline}
                          disabled={boardBusy}
                          data-testid={`weekly-view-${def.key}`}
                          onClick={() => onView(def.key)}
                        >
                          查看内容
                        </Button>
                      </div>
                    </details>
                  ) : null}
                </div>
              </P0Card>
            );
          },
        )}
      </div>
    </section>
  );
}
