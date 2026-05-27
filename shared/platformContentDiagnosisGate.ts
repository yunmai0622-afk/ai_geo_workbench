/** 平台化内容生成 — AI 诊断 / 优化任务 / 选题 状态闸门（共享层，供前后端与单测复用） */

export const PLATFORM_CONTENT_NO_AI_DIAGNOSIS_MESSAGE =
  "请先完成 AI 实测诊断，再生成平台内容。";

export const PLATFORM_CONTENT_NO_OPTIMIZATION_TASKS_MESSAGE =
  "已完成 AI 诊断，但还没有生成内容优化任务。请返回诊断页生成优化任务后再试。";

export const PLATFORM_CONTENT_STALE_TOPICS_MESSAGE =
  "内容选题与当前优化任务不一致，请重新生成内容选题后再试。";

export const PLATFORM_CONTENT_NO_TOPICS_MESSAGE =
  "当前还没有可用的内容选题。请先生成本周内容选题。";

export const PLATFORM_CONTENT_NO_PLATFORM_TASK_MESSAGE =
  "当前平台暂无可用生成任务，请选择其他平台或重新生成优化任务。";

export const PLATFORM_CONTENT_TOPIC_UNBOUND_MESSAGE =
  "所选内容选题未绑定优化任务，请重新生成内容选题。";

export type PlatformDiagnosisGateStage =
  | "no_analysis"
  | "no_tasks"
  | "stale_topics"
  | "no_topics"
  | "ready";

export type PlatformContentDiagnosisGateInput = {
  analysisCount: number;
  taskIds: number[];
  topics: Array<{ id?: number; optimizationTaskId?: number | null }>;
};

export type PlatformContentDiagnosisGateResult = {
  ready: boolean;
  stage: PlatformDiagnosisGateStage;
  message: string;
  staleTopicCount: number;
};

export function taskIdSetFromList(taskIds: number[]): Set<number> {
  return new Set(taskIds.filter(id => Number.isFinite(id) && id > 0));
}

export function isTopicBoundToProjectTasks(
  topic: { optimizationTaskId?: number | null },
  taskIds: Set<number>,
): boolean {
  const taskId = topic.optimizationTaskId;
  if (taskId == null || taskId <= 0) return false;
  return taskIds.has(taskId);
}

export function countStaleTopics(
  topics: Array<{ optimizationTaskId?: number | null }>,
  taskIds: Set<number>,
): number {
  return topics.filter(t => !isTopicBoundToProjectTasks(t, taskIds)).length;
}

export function evaluatePlatformContentDiagnosisGate(
  input: PlatformContentDiagnosisGateInput,
): PlatformContentDiagnosisGateResult {
  const taskIds = taskIdSetFromList(input.taskIds);
  const staleTopicCount = countStaleTopics(input.topics, taskIds);
  const boundTopicCount = input.topics.filter(t => isTopicBoundToProjectTasks(t, taskIds)).length;

  if (input.analysisCount <= 0 && taskIds.size === 0) {
    return {
      ready: false,
      stage: "no_analysis",
      message: PLATFORM_CONTENT_NO_AI_DIAGNOSIS_MESSAGE,
      staleTopicCount,
    };
  }

  if (taskIds.size === 0) {
    return {
      ready: false,
      stage: "no_tasks",
      message: PLATFORM_CONTENT_NO_OPTIMIZATION_TASKS_MESSAGE,
      staleTopicCount,
    };
  }

  if (input.topics.length > 0 && staleTopicCount === input.topics.length) {
    return {
      ready: false,
      stage: "stale_topics",
      message: PLATFORM_CONTENT_STALE_TOPICS_MESSAGE,
      staleTopicCount,
    };
  }

  if (boundTopicCount === 0) {
    return {
      ready: false,
      stage: "no_topics",
      message: PLATFORM_CONTENT_NO_TOPICS_MESSAGE,
      staleTopicCount,
    };
  }

  return {
    ready: true,
    stage: "ready",
    message: "",
    staleTopicCount,
  };
}
