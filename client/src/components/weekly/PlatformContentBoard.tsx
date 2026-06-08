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
        <h2 className={geoP0Surfaces.sectionTitle}>平台生成入口</h2>
        <p className={geoP0Surfaces.muted}>按平台生成内容，查看各平台生成与入队进度。</p>
      </div>
      <div
        className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3"
        data-testid="weekly-platform-matrix-grid"
      >
        {rows.map(
          ({
            def,
            counts,
            pendingReviewCount,
            queuedCount,
            lastGeneratedAtLabel,
            status,
            hasContent,
          }) => {
            const generatedCount = counts.pendingConfirm + counts.ready + counts.published;
            const statusLabel = weeklyContentTaskStatusLabel(status);
            const isGenerating = status === "GENERATING" || generatingPlatformKey === def.key;

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
                    <dt>已生成</dt>
                    <dd className="font-medium text-gray-800">{generatedCount}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>可入队</dt>
                    <dd className="font-medium text-gray-800">{counts.ready}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>待审核</dt>
                    <dd className="font-medium text-gray-800">{pendingReviewCount}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>已入队</dt>
                    <dd className="font-medium text-gray-800">{queuedCount}</dd>
                  </div>
                  {lastGeneratedAtLabel ? (
                    <div className="flex justify-between gap-2 pt-1">
                      <dt>最近生成</dt>
                      <dd className="text-gray-700">{lastGeneratedAtLabel}</dd>
                    </div>
                  ) : null}
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
