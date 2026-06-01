import type { WeeklyPlatformKey } from "./articlePublishPlatform";
import { parseGeoOptimizationTaskCard } from "./geoContentTaskSource";
import { isTopicBoundToProjectTasks } from "./platformContentDiagnosisGate";

export type PlatformTopicRow = {
  id: number;
  optimizationTaskId?: number | null;
  title: string;
  articleType?: string | null;
  businessReason?: string | null;
  status?: string | null;
};

export type PlatformTopicTaskRow = {
  id: number;
  executionSuggestion?: string | null;
};

export type FindPendingPlatformTopicOptions = {
  /** 为 true 时不按当前内容任务 optimizationTaskId 过滤 */
  relaxTaskFilter?: boolean;
  /** 为 true 时不按推荐平台过滤 */
  relaxPlatformMatch?: boolean;
  activeTaskId?: number | null;
};

const ZHIHU_PLATFORM_ALIASES = ["知乎", "知乎回答", "知乎专栏", "知乎直答", "zhihu", "Zhihu"] as const;

/** 判断优化任务推荐平台是否匹配目标平台展示名 */
export function matchTopicToPlatform(recommendedPlatforms: string[], platformLabel: string): boolean {
  if (recommendedPlatforms.length === 0) return true;
  const label = platformLabel.trim();
  if (!label) return true;
  const labelLower = label.toLowerCase();
  if (label === "知乎") {
    return recommendedPlatforms.some(p => {
      const t = p.trim();
      if (!t) return false;
      if (ZHIHU_PLATFORM_ALIASES.some(alias => t.includes(alias) || alias.toLowerCase().includes(t.toLowerCase()))) {
        return true;
      }
      return t.includes(label) || label.includes(t);
    });
  }
  return recommendedPlatforms.some(p => {
    const t = p.trim();
    if (!t) return false;
    return t.includes(label) || label.includes(t) || t.toLowerCase().includes(labelLower);
  });
}

export function buildArticleTopicIdSet(articles: Array<{ topicId?: number | null }>): Set<number> {
  const ids = new Set<number>();
  for (const article of articles) {
    if (typeof article.topicId === "number" && article.topicId > 0) ids.add(article.topicId);
  }
  return ids;
}

export function countUnassignedPendingTopics(
  topicRows: PlatformTopicRow[],
  articleTopicIds: Set<number>,
  taskIdSet: Set<number>,
): number {
  return topicRows.filter(
    t => t?.id && !articleTopicIds.has(t.id) && isTopicBoundToProjectTasks(t, taskIdSet),
  ).length;
}

export function findPendingTopicForPlatformGeneration(
  platformLabel: string,
  topicRows: PlatformTopicRow[],
  articleTopicIds: Set<number>,
  tasks: PlatformTopicTaskRow[],
  taskIdSet: Set<number>,
  options?: FindPendingPlatformTopicOptions,
): PlatformTopicRow | undefined {
  const activeTaskId = options?.relaxTaskFilter === true ? null : (options?.activeTaskId ?? null);
  return topicRows.find(t => {
    if (!t?.id || articleTopicIds.has(t.id)) return false;
    if (!isTopicBoundToProjectTasks(t, taskIdSet)) return false;
    if (activeTaskId != null && t.optimizationTaskId !== activeTaskId) return false;
    if (options?.relaxPlatformMatch === true) return true;
    const task = tasks.find(row => row?.id === t.optimizationTaskId);
    const card = parseGeoOptimizationTaskCard(task?.executionSuggestion ?? null);
    return matchTopicToPlatform(card?.recommendedPlatform ?? [], platformLabel);
  });
}

export function findAnyBoundPendingTopic(
  topicRows: PlatformTopicRow[],
  articleTopicIds: Set<number>,
  taskIdSet: Set<number>,
): PlatformTopicRow | undefined {
  return topicRows.find(t => {
    if (!t?.id || articleTopicIds.has(t.id)) return false;
    return isTopicBoundToProjectTasks(t, taskIdSet);
  });
}

export function isTopicIdInRows(topicId: number, topicRows: PlatformTopicRow[]): boolean {
  return topicRows.some(t => t.id === topicId);
}

export type ResolvePendingPlatformTopicInput = {
  platformKey: WeeklyPlatformKey;
  platformLabel: string;
  topicRows: PlatformTopicRow[];
  articleTopicIds: Set<number>;
  tasks: PlatformTopicTaskRow[];
  taskIdSet: Set<number>;
  activeTaskId?: number | null;
};

/** 为单平台生成挑选尚未落库的选题（纯函数，供前后端单测） */
export function resolvePendingPlatformTopic(
  input: ResolvePendingPlatformTopicInput,
): PlatformTopicRow | undefined {
  const base = {
    activeTaskId: input.activeTaskId ?? null,
  };
  return (
    findPendingTopicForPlatformGeneration(
      input.platformLabel,
      input.topicRows,
      input.articleTopicIds,
      input.tasks,
      input.taskIdSet,
      base,
    ) ??
    findPendingTopicForPlatformGeneration(
      input.platformLabel,
      input.topicRows,
      input.articleTopicIds,
      input.tasks,
      input.taskIdSet,
      { ...base, relaxTaskFilter: true },
    ) ??
    findPendingTopicForPlatformGeneration(
      input.platformLabel,
      input.topicRows,
      input.articleTopicIds,
      input.tasks,
      input.taskIdSet,
      { ...base, relaxTaskFilter: true, relaxPlatformMatch: true },
    ) ??
    findAnyBoundPendingTopic(input.topicRows, input.articleTopicIds, input.taskIdSet)
  );
}
