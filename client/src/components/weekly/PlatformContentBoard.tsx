import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import {
  type PlatformContentCounts,
  type WeeklyPlatformDef,
  type WeeklyPlatformKey,
} from "@/lib/weeklyPlatformBoard";
import {
  resolvePlatformTaskAction,
  shouldDisablePlatformGenerateButton,
  showSerialGenerationHint,
  WEEKLY_SERIAL_GENERATION_HINT,
  type PlatformTaskActionKind,
} from "@shared/weeklyContentTaskBoard";
import { contentAssetLifecycleBadgeClass } from "@/components/content/ContentAssetLifecycleDisplay";
import type { ContentAssetLifecycleView } from "@shared/contentAssetLifecycle";
import type { WeeklyContentTaskStatus } from "@shared/weeklyContentTaskStatus";
import { cn } from "@/lib/utils";

export const PRIMARY_ACTION_LABEL = {
  generate_platform_draft: "生成平台稿",
  save_and_qc: "查看并质检",
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
  lifecycle: ContentAssetLifecycleView;
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
  activeInFlightPlatformKey?: WeeklyPlatformKey | null;
  anyGenerating?: boolean;
  onGenerate: (key: WeeklyPlatformDef["key"]) => void;
  onSaveAndQc: (key: WeeklyPlatformDef["key"]) => void;
  onEnqueue: (key: WeeklyPlatformDef["key"]) => void;
  onView: (key: WeeklyPlatformDef["key"]) => void;
  onViewPublish?: (key: WeeklyPlatformDef["key"]) => void;
  onGoMonitoring?: () => void;
};

export function PlatformContentBoard({
  rows,
  boardBusy = false,
  generatingPlatformKey = null,
  activeInFlightPlatformKey = null,
  anyGenerating = false,
  onGenerate,
  onSaveAndQc,
  onEnqueue,
  onView,
  onViewPublish,
  onGoMonitoring,
}: Props) {
  const handleAction = (row: PlatformBoardRow, kind: PlatformTaskActionKind) => {
    switch (kind) {
      case "generate":
      case "regenerate":
        onGenerate(row.def.key);
        break;
      case "view_qc":
        onSaveAndQc(row.def.key);
        break;
      case "enqueue":
        onEnqueue(row.def.key);
        break;
      case "view_publish":
        if (onViewPublish) onViewPublish(row.def.key);
        else onView(row.def.key);
        break;
      case "view_article":
        onView(row.def.key);
        break;
      case "go_monitoring":
        if (onGoMonitoring) onGoMonitoring();
        else onView(row.def.key);
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
        <h2 className={geoP0Surfaces.sectionTitle}>平台内容任务</h2>
        <p className={geoP0Surfaces.muted}>按平台推进内容生成、质检与发布。</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2" data-testid="weekly-platform-matrix-grid">
        {rows.map(row => {
          const { def, status, hasContent, lifecycle } = row;
          const statusLabel = lifecycle.label;
          const action = resolvePlatformTaskAction(status, hasContent);
          const disabled = shouldDisablePlatformGenerateButton({
            status,
            boardBusy,
            generatingPlatformKey,
            activeInFlightPlatformKey,
            platformKey: def.key,
            anyGenerating,
          });
          const serialHint = showSerialGenerationHint({
            anyGenerating,
            generatingPlatformKey,
            activeInFlightPlatformKey,
            platformKey: def.key,
            actionKind: action.kind,
          });

          return (
            <P0Card key={def.key} testId={`weekly-platform-card-${def.key}`} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-900">{def.label}</h3>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    contentAssetLifecycleBadgeClass(lifecycle.stage),
                  )}
                  data-testid={`weekly-platform-status-${def.key}`}
                >
                  {statusLabel}
                </span>
              </div>

              {serialHint ? (
                <p className="mt-2 text-xs text-amber-700">{WEEKLY_SERIAL_GENERATION_HINT}</p>
              ) : null}

              <div className="mt-4 flex flex-1 flex-col gap-2 border-t border-gray-100 pt-4">
                <Button
                  type="button"
                  size="sm"
                  className={geoP0Brand.primary}
                  disabled={disabled && (action.kind === "generate" || action.kind === "regenerate")}
                  data-testid={`weekly-primary-${row.primaryActionKind}-${def.key}`}
                  onClick={() => handleAction(row, action.kind)}
                >
                  {action.label}
                </Button>
              </div>
            </P0Card>
          );
        })}
      </div>
    </section>
  );
}
