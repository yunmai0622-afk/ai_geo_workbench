import {
  buildContentAssetLifecycleProgressLabels,
  resolveContentAssetLifecycleStage,
  type ContentAssetLifecycleArticleInput,
  type ContentAssetLifecycleInclusionRecordInput,
  type ContentAssetLifecyclePublishRecordInput,
  type ContentAssetLifecyclePublishTaskInput,
  type ContentAssetLifecycleStage,
  type ContentAssetLifecycleView,
} from "@shared/contentAssetLifecycle";
import { cn } from "@/lib/utils";

export type ContentAssetLifecycleBadgeProps = {
  view: ContentAssetLifecycleView;
  className?: string;
  testId?: string;
};

const STAGE_BADGE_CLASS: Record<ContentAssetLifecycleStage, string> = {
  not_started: "bg-gray-100 text-gray-600",
  generated: "bg-amber-50 text-amber-800",
  pending_review: "bg-orange-100 text-orange-800",
  review_passed: "bg-sky-100 text-sky-800",
  queued: "bg-violet-100 text-violet-800",
  published: "bg-emerald-100 text-emerald-900",
  pending_inclusion: "bg-yellow-50 text-yellow-900",
  included: "bg-teal-100 text-teal-900",
  has_exposure: "bg-blue-100 text-blue-900",
  can_retest: "bg-indigo-100 text-indigo-900",
  retested: "bg-purple-100 text-purple-900",
};

export function contentAssetLifecycleBadgeClass(stage: ContentAssetLifecycleStage): string {
  return STAGE_BADGE_CLASS[stage];
}

export function ContentAssetLifecycleBadge({ view, className, testId }: ContentAssetLifecycleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
        contentAssetLifecycleBadgeClass(view.stage),
        className,
      )}
      data-testid={testId}
    >
      {view.label}
    </span>
  );
}

type ContentAssetLifecycleProgressProps = {
  stage: ContentAssetLifecycleStage;
  compact?: boolean;
  testId?: string;
};

export function ContentAssetLifecycleProgress({
  stage,
  compact = false,
  testId,
}: ContentAssetLifecycleProgressProps) {
  const steps = buildContentAssetLifecycleProgressLabels(stage);
  return (
    <div className={cn("space-y-2", compact ? "" : "min-w-0")} data-testid={testId}>
      <p className="text-xs font-medium text-gray-700">当前阶段</p>
      <div className="flex flex-wrap gap-1.5">
        {steps.map(item => (
          <span
            key={item.stage}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              item.current
                ? "bg-blue-600 text-white"
                : item.reached
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                  : "bg-gray-100 text-gray-400",
            )}
            title={item.label}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function buildLifecycleViewFromWeeklyArticle(input: {
  article?: ContentAssetLifecycleArticleInput | null;
  publishRecord?: ContentAssetLifecyclePublishRecordInput | null;
  inclusionRecord?: ContentAssetLifecycleInclusionRecordInput | null;
  publishTask?: ContentAssetLifecyclePublishTaskInput | null;
  generating?: boolean;
}): ContentAssetLifecycleView {
  return resolveContentAssetLifecycleStage(input);
}
