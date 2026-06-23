import type { WeeklyContentTaskStatus } from "./weeklyContentTaskStatus";

export const WEEKLY_SERIAL_GENERATION_HINT =
  "当前已有平台稿正在生成，完成后可继续生成其他平台。";

export type TaskBoardProgressMetrics = {
  needGenerate: number;
  generated: number;
  qualityPending: number;
  enqueueReady: number;
  queued: number;
  published: number;
  total: number;
};

export function computeTaskBoardProgress(
  rows: Array<{ status: WeeklyContentTaskStatus }>,
): TaskBoardProgressMetrics {
  const total = rows.length;
  let needGenerate = 0;
  let generated = 0;
  let qualityPending = 0;
  let enqueueReady = 0;
  let queued = 0;
  let published = 0;

  for (const row of rows) {
    switch (row.status) {
      case "UNGENERATED":
        needGenerate += 1;
        break;
      case "GENERATING":
        needGenerate += 1;
        break;
      case "DRAFT":
      case "QUALITY_PENDING":
        generated += 1;
        qualityPending += 1;
        break;
      case "QUALITY_PASSED":
      case "NEEDS_REWRITE":
        generated += 1;
        break;
      case "PUBLISH_READY":
        generated += 1;
        enqueueReady += 1;
        break;
      case "QUEUED":
        generated += 1;
        queued += 1;
        break;
      case "PUBLISHED":
        generated += 1;
        published += 1;
        break;
    }
  }

  return {
    needGenerate,
    generated,
    qualityPending,
    enqueueReady,
    queued,
    published,
    total,
  };
}

export function buildTaskBoardNextStepSuggestion(metrics: TaskBoardProgressMetrics): string {
  if (metrics.total === 0) {
    return "先选择推荐平台生成第一批平台稿";
  }
  if (metrics.published > 0 && metrics.published === metrics.generated) {
    return "进入收录监测，等待后续 AI 复测";
  }
  if (metrics.enqueueReady > 0) {
    return "将已通过内容加入发布队列";
  }
  if (metrics.qualityPending > 0 && metrics.needGenerate < metrics.total) {
    return "优先完成已生成内容的质检，再继续生成其他平台";
  }
  if (metrics.generated === 0 || metrics.needGenerate === metrics.total) {
    return "先选择推荐平台生成第一批平台稿";
  }
  if (metrics.needGenerate > 0) {
    return "优先完成已生成内容的质检，再继续生成其他平台";
  }
  return "按推荐平台继续推进内容生成与发布";
}

export type PlatformTaskActionKind =
  | "generate"
  | "view_qc"
  | "enqueue"
  | "view_publish"
  | "regenerate"
  | "view_article"
  | "go_monitoring";

export function resolvePlatformTaskAction(
  status: WeeklyContentTaskStatus,
  hasContent: boolean,
): { kind: PlatformTaskActionKind; label: string } {
  if (status === "GENERATING") {
    return { kind: "generate", label: "生成中…" };
  }
  if (status === "NEEDS_REWRITE") {
    return { kind: "regenerate", label: "重新生成" };
  }
  if (status === "PUBLISHED") {
    return { kind: "go_monitoring", label: "去收录监测" };
  }
  if (status === "QUEUED") {
    return { kind: "view_publish", label: "查看发布任务" };
  }
  if (status === "PUBLISH_READY") {
    return { kind: "enqueue", label: "加入发布队列" };
  }
  if (status === "QUALITY_PENDING" || status === "DRAFT") {
    return { kind: "view_qc", label: "查看并质检" };
  }
  if (status === "QUALITY_PASSED" && hasContent) {
    return { kind: "view_qc", label: "查看并质检" };
  }
  if (hasContent) {
    return { kind: "view_article", label: "查看文章" };
  }
  return { kind: "generate", label: "生成平台稿" };
}

export function shouldDisablePlatformGenerateButton(input: {
  status: WeeklyContentTaskStatus;
  boardBusy: boolean;
  generatingPlatformKey: string | null;
  platformKey: string;
  anyGenerating: boolean;
}): boolean {
  if (input.status === "GENERATING") return true;
  if (input.generatingPlatformKey === input.platformKey) return true;
  if (input.boardBusy && input.generatingPlatformKey === input.platformKey) return true;
  if (input.anyGenerating && input.generatingPlatformKey && input.generatingPlatformKey !== input.platformKey) {
    return true;
  }
  return false;
}

export function showSerialGenerationHint(input: {
  anyGenerating: boolean;
  generatingPlatformKey: string | null;
  platformKey: string;
  actionKind: PlatformTaskActionKind;
}): boolean {
  return (
    input.actionKind === "generate" &&
    input.anyGenerating &&
    Boolean(input.generatingPlatformKey) &&
    input.generatingPlatformKey !== input.platformKey
  );
}
