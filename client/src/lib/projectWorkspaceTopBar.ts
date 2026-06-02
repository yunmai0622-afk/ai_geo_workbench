import type { WorkspaceStageDefinition } from "@shared/workspaceStateMachine";

/** 顶栏：有 CTA 时只展示一个主按钮，避免「阶段徽标 + 操作按钮」重复 */
export function resolveProjectTopBarPresentation(
  stageLabel: string | null | undefined,
  ctaStage: WorkspaceStageDefinition | null | undefined,
): {
  stageBadgeLabel: string | null;
  actionLabel: string | null;
} {
  if (ctaStage?.ctaLabel) {
    return { stageBadgeLabel: null, actionLabel: ctaStage.ctaLabel };
  }
  if (stageLabel) {
    return { stageBadgeLabel: stageLabel, actionLabel: null };
  }
  return { stageBadgeLabel: null, actionLabel: null };
}
