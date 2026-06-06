import { P0Card } from "@/components/geo/P0UiPrimitives";
import { PlatformContentGuidelineHelp } from "@/components/weekly/PlatformContentGuidelineHelp";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import {
  formatCountsLine,
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
  platformRole: string;
  platformGenerationGoal: string;
  publishHint: string;
  status: WeeklyContentTaskStatus;
  title?: string | null;
  geoGap?: string | null;
  hasContent: boolean;
  articleId?: number | null;
  canEnqueue?: boolean;
};

type Props = {
  rows: PlatformBoardRow[];
  /** 批量生成等全局忙碌：禁用全部平台按钮 */
  boardBusy?: boolean;
  /** 当前正在生成的平台（仅禁用该平台「生成」按钮） */
  generatingPlatformKey?: WeeklyPlatformKey | null;
  onGenerate: (key: WeeklyPlatformDef["key"]) => void;
  onView: (key: WeeklyPlatformDef["key"]) => void;
  onEdit?: (key: WeeklyPlatformDef["key"]) => void;
  onRegenerate?: (key: WeeklyPlatformDef["key"]) => void;
  onEnqueue?: (key: WeeklyPlatformDef["key"]) => void;
};

export function PlatformContentBoard({
  rows,
  boardBusy = false,
  generatingPlatformKey = null,
  onGenerate,
  onView,
  onEdit,
  onRegenerate,
  onEnqueue,
}: Props) {
  return (
    <section
      id="weekly-section-platform-matrix"
      className="scroll-mt-24 space-y-4"
      data-testid="weekly-platform-board"
    >
      <div className="space-y-1">
        <h2 className={geoP0Surfaces.sectionTitle}>平台内容矩阵</h2>
        <p className={geoP0Surfaces.muted}>
          各平台围绕同一轮 GEO 内容任务独立生成。请按平台分别生成本轮内容资产。
        </p>
      </div>
      <div
        className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3"
        data-testid="weekly-platform-matrix-grid"
      >
        {rows.map(({ def, counts, platformGenerationGoal, status, title, geoGap, hasContent, canEnqueue }) => {
          const countsLine = formatCountsLine(counts);
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
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-medium text-gray-500">平台内容目标：</span>
                <span data-testid="weekly-platform-generation-goal">{platformGenerationGoal}</span>
              </p>
              {title ? (
                <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-900" data-testid={`weekly-platform-title-${def.key}`}>
                  {title}
                </p>
              ) : null}
              {geoGap ? (
                <p className="mt-1 line-clamp-2 text-xs text-gray-600" data-testid={`weekly-platform-gap-${def.key}`}>
                  <span className="font-medium text-gray-500">对应 GEO 缺口：</span>
                  {geoGap}
                </p>
              ) : null}
              {countsLine ? (
                <p className="mt-2 text-[11px] text-gray-500" data-testid="weekly-platform-counts">
                  待生成 {counts.pending} / 已生成 {generatedCount} / 可发布 {counts.ready} / 已发布{" "}
                  {counts.published}
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-400">暂无内容记录</p>
              )}
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
                  <>
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
                    {onEdit ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={geoP0Brand.primaryOutline}
                        disabled={boardBusy}
                        data-testid={`weekly-edit-${def.key}`}
                        onClick={() => onEdit(def.key)}
                      >
                        编辑
                      </Button>
                    ) : null}
                    {onRegenerate ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={geoP0Brand.primaryOutline}
                        disabled={boardBusy || isGenerating}
                        data-testid={`weekly-regenerate-${def.key}`}
                        onClick={() => onRegenerate(def.key)}
                      >
                        重新生成
                      </Button>
                    ) : null}
                    {canEnqueue && onEnqueue ? (
                      <Button
                        type="button"
                        size="sm"
                        className={geoP0Brand.primary}
                        disabled={boardBusy}
                        data-testid={`weekly-enqueue-${def.key}`}
                        onClick={() => onEnqueue(def.key)}
                      >
                        加入发布队列
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </P0Card>
          );
        })}
      </div>
    </section>
  );
}
