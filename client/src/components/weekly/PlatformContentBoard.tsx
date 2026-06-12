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

export const PRIMARY_ACTION_LABEL = {
  generate_platform_draft: "生成平台稿",
  save_and_qc: "保存并质检",
  enqueue_publish: "加入发布队列",
} as const;

export type PlatformBoardPrimaryActionKind = keyof typeof PRIMARY_ACTION_LABEL;

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
  platformDraftStatusLabel: string;
  qualityScoreLabel: string;
  accountStatusLabel: string;
  primaryActionKind: PlatformBoardPrimaryActionKind;
};

type Props = {
  rows: PlatformBoardRow[];
  boardBusy?: boolean;
  generatingPlatformKey?: WeeklyPlatformKey | null;
  onGenerate: (key: WeeklyPlatformDef["key"]) => void;
  onSaveAndQc: (key: WeeklyPlatformDef["key"]) => void;
  onEnqueue: (key: WeeklyPlatformDef["key"]) => void;
  onView: (key: WeeklyPlatformDef["key"]) => void;
};

export function PlatformContentBoard({
  rows,
  boardBusy = false,
  generatingPlatformKey = null,
  onGenerate,
  onSaveAndQc,
  onEnqueue,
  onView,
}: Props) {
  const handlePrimaryAction = (row: PlatformBoardRow) => {
    switch (row.primaryActionKind) {
      case "generate_platform_draft":
        onGenerate(row.def.key);
        break;
      case "save_and_qc":
        onSaveAndQc(row.def.key);
        break;
      case "enqueue_publish":
        onEnqueue(row.def.key);
        break;
    }
  };

  return (
    <section
      id="weekly-section-platform-matrix"
      className="scroll-mt-24 space-y-4"
      data-testid="weekly-platform-board"
    >
      <div className="space-y-1">
        <h2 className={geoP0Surfaces.sectionTitle}>平台发布计划</h2>
        <p className={geoP0Surfaces.muted}>按平台查看稿状态、质检与账号，推进生成与入队。</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2" data-testid="weekly-platform-matrix-grid">
        {rows.map(row => {
          const {
            def,
            status,
            platformDraftStatusLabel,
            qualityScoreLabel,
            accountStatusLabel,
            primaryActionKind,
            hasContent,
          } = row;
          const statusLabel = weeklyContentTaskStatusLabel(status);
          const isGenerating = status === "GENERATING" || generatingPlatformKey === def.key;
          const primaryLabel = PRIMARY_ACTION_LABEL[primaryActionKind];

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
              <dl className="mt-3 space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between gap-2">
                  <dt>平台稿状态</dt>
                  <dd className="font-medium text-gray-800" data-testid={`weekly-platform-draft-status-${def.key}`}>
                    {platformDraftStatusLabel}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>质检分</dt>
                  <dd className="text-gray-800" data-testid={`weekly-platform-quality-${def.key}`}>
                    {qualityScoreLabel}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>账号状态</dt>
                  <dd className="font-medium text-gray-800" data-testid={`weekly-platform-account-${def.key}`}>
                    {accountStatusLabel}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-1 flex-col gap-2 border-t border-gray-100 pt-4">
                <Button
                  type="button"
                  size="sm"
                  className={geoP0Brand.primary}
                  disabled={boardBusy || isGenerating}
                  data-testid={`weekly-primary-${primaryActionKind}-${def.key}`}
                  onClick={() => handlePrimaryAction(row)}
                >
                  {isGenerating && primaryActionKind === "generate_platform_draft" ? "生成中…" : primaryLabel}
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
        })}
      </div>
    </section>
  );
}
