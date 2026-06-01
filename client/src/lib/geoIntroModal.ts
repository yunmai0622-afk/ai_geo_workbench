/** GEO V1.1 首次登录系统介绍弹窗（值为 "1" 表示已展示并关闭） */
export const GEO_INTRO_MODAL_STORAGE_KEY = "geo-v1.1-intro-modal:seen";

export function isGeoIntroModalDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(GEO_INTRO_MODAL_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function dismissGeoIntroModal(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GEO_INTRO_MODAL_STORAGE_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}
