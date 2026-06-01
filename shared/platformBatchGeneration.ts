export type PlatformBatchItemStatus = "pending" | "running" | "completed" | "failed";

export type PlatformBatchQueueItem = {
  platformKey: string;
  label: string;
  status: PlatformBatchItemStatus;
  errorMessage?: string;
};

export function buildPlatformBatchQueue(
  platforms: ReadonlyArray<{ key: string; label: string }>,
): PlatformBatchQueueItem[] {
  return platforms.map(({ key, label }) => ({
    platformKey: key,
    label,
    status: "pending",
  }));
}

export function countPlatformBatchCompleted(items: PlatformBatchQueueItem[]): number {
  return items.filter(item => item.status === "completed").length;
}

export function countPlatformBatchFinished(items: PlatformBatchQueueItem[]): number {
  return items.filter(item => item.status === "completed" || item.status === "failed").length;
}

export function updatePlatformBatchItemStatus(
  items: PlatformBatchQueueItem[],
  platformKey: string,
  update: Partial<Pick<PlatformBatchQueueItem, "status" | "errorMessage">>,
): PlatformBatchQueueItem[] {
  return items.map(item => (item.platformKey === platformKey ? { ...item, ...update } : item));
}

export function platformBatchStatusLabel(status: PlatformBatchItemStatus): string {
  switch (status) {
    case "pending":
      return "等待中";
    case "running":
      return "进行中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
  }
}

export function formatPlatformBatchProgress(completed: number, total: number): string {
  return `已完成 ${completed}/${total} 个平台`;
}
