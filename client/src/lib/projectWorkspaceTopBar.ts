import { shouldShowPublishBindTopChrome } from "@shared/globalNavVisibility";
import type { WorkspaceStageDefinition } from "@shared/workspaceStateMachine";

/** 顶栏：有 CTA 时只展示一个主按钮，避免「阶段徽标 + 操作按钮」重复 */
export function resolveProjectTopBarPresentation(
  pathname: string,
  stageLabel: string | null | undefined,
  ctaStage: WorkspaceStageDefinition | null | undefined,
): {
  stageBadgeLabel: string | null;
  actionLabel: string | null;
} {
  const showBindChrome = shouldShowPublishBindTopChrome(
    pathname,
    ctaStage?.id ?? null,
    stageLabel ?? null,
  );

  if (!showBindChrome) {
    const isBindOnly =
      ctaStage?.id === "bind_publish_env" || stageLabel === "待绑定发布";
    if (isBindOnly) {
      return { stageBadgeLabel: null, actionLabel: null };
    }
  }

  if (ctaStage?.ctaLabel) {
    return { stageBadgeLabel: null, actionLabel: ctaStage.ctaLabel };
  }
  if (stageLabel) {
    return { stageBadgeLabel: stageLabel, actionLabel: null };
  }
  return { stageBadgeLabel: null, actionLabel: null };
}
