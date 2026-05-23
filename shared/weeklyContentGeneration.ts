export const DEFAULT_WEEKLY_GENERATION_COUNT = 7;
export const MIN_WEEKLY_GENERATION_COUNT = 1;
export const MAX_WEEKLY_GENERATION_COUNT = 50;

export const WEEKLY_GENERATION_COUNT_PRESETS = [7, 14, 21] as const;

export function normalizeWeeklyGenerationCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return DEFAULT_WEEKLY_GENERATION_COUNT;
  return n;
}

/** 返回客户化错误文案；通过则返回 null */
export function weeklyGenerationCountClientError(value: unknown): string | null {
  if (value === "" || value === null || value === undefined) {
    return "请填写生成篇数";
  }
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return "请填写有效的生成篇数";
  }
  if (n < MIN_WEEKLY_GENERATION_COUNT) {
    return "生成篇数不能少于 1 篇";
  }
  if (n > MAX_WEEKLY_GENERATION_COUNT) {
    return "单次最多生成 50 篇内容";
  }
  return null;
}

export function weeklyGenerationCountServerError(value: unknown): string | null {
  return weeklyGenerationCountClientError(value);
}
