/** 用户关闭系统公告时写入 localStorage 的版本键（与库中 systemAnnouncementUpdatedAt 对齐） */
export const SYSTEM_ANNOUNCEMENT_DISMISS_STORAGE_KEY = "geo.systemAnnouncement.dismissedVersion";

export type SystemAnnouncementPublic = {
  enabled: boolean;
  body: string;
  /** 公告版本标识；用户关闭后记录此值，管理员更新公告后变更以再次展示 */
  versionKey: string | null;
};

export function shouldShowSystemAnnouncement(
  announcement: SystemAnnouncementPublic,
  dismissedVersion: string | null,
): boolean {
  if (!announcement.enabled) return false;
  const body = announcement.body.trim();
  if (!body) return false;
  if (!announcement.versionKey) return true;
  return dismissedVersion !== announcement.versionKey;
}

export function readDismissedAnnouncementVersion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SYSTEM_ANNOUNCEMENT_DISMISS_STORAGE_KEY);
    return raw?.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function writeDismissedAnnouncementVersion(versionKey: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SYSTEM_ANNOUNCEMENT_DISMISS_STORAGE_KEY, versionKey);
  } catch {
    // ignore quota / private mode
  }
}
