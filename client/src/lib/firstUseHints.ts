/** GEO V1.1 各页首次使用提示 localStorage 键（值为 "1" 表示已展示并关闭） */
export const FIRST_USE_HINT_KEYS = {
  workspace: "geo-v1.1-first-use-hint:workspace",
  aiDiagnosis: "geo-v1.1-first-use-hint:ai-diagnosis",
  contentPublishing: "geo-v1.1-first-use-hint:content-publishing",
  inclusionMonitoring: "geo-v1.1-first-use-hint:inclusion-monitoring",
} as const;

export type FirstUseHintKey = (typeof FIRST_USE_HINT_KEYS)[keyof typeof FIRST_USE_HINT_KEYS];

export function isFirstUseHintDismissed(storageKey: FirstUseHintKey): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(storageKey) === "1";
  } catch {
    return true;
  }
}

export function dismissFirstUseHint(storageKey: FirstUseHintKey): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, "1");
  } catch {
    // ignore quota / private mode
  }
}
