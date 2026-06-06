export const PROJECT_SCOPED_CONTENT_TASK_MISMATCH_MESSAGE =
  "当前内容任务不属于该企业项目，请刷新后重试。";

export const PROJECT_SCOPED_CONTENT_TASK_STALE_CLIENT_MESSAGE =
  "当前内容任务已失效，请重新选择本项目的内容任务。";

export const PROJECT_SCOPED_CONTENT_TASK_EMPTY_FOR_PROJECT_MESSAGE =
  "暂无本项目内容任务，请先完成 AI 实测诊断或重新生成内容任务。";

export type ProjectScopedOptimizationTaskRow = { id: number };

export function isContentTaskIdInProjectTaskList(
  contentTaskId: number | null | undefined,
  tasks: readonly ProjectScopedOptimizationTaskRow[],
): boolean {
  if (contentTaskId == null || !Number.isFinite(contentTaskId) || contentTaskId <= 0) return false;
  return tasks.some(t => t.id === contentTaskId);
}
