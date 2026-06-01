/** GEO-V1.1-Account-Select-Polish：加入发布队列弹窗账号选择与记忆 */

export const PUBLISH_ENQUEUE_LAST_ACCOUNT_STORAGE_PREFIX = "geo.publish.enqueueAccount";

export function publishEnqueueAccountStorageKey(projectId: number, platform: string): string {
  return `${PUBLISH_ENQUEUE_LAST_ACCOUNT_STORAGE_PREFIX}:${projectId}:${platform}`;
}

export function readLastEnqueuePublishAccountId(projectId: number, platform: string): number | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(publishEnqueueAccountStorageKey(projectId, platform));
    if (!raw) return null;
    const id = Number.parseInt(raw, 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function writeLastEnqueuePublishAccountId(projectId: number, platform: string, accountId: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(publishEnqueueAccountStorageKey(projectId, platform), String(accountId));
  } catch {
    // ignore quota / private mode
  }
}

/** 发布弹窗下拉：登录状态短文案 */
export function publishEnqueueLoginStatusLabel(sessionStatus: string | null | undefined): string {
  if (sessionStatus === "active") return "有效";
  if (sessionStatus === "expired") return "需重新登录";
  return "未检测";
}

export function formatPublishEnqueueLastPublishedAt(value: Date | string | null | undefined): string {
  if (!value) return "暂无";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "暂无";
  return d.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatPublishEnqueueAccountOptionLabel(input: {
  accountName: string;
  sessionStatus: string | null | undefined;
  lastLoginAt?: Date | string | null;
}): string {
  const name = input.accountName?.trim() || "未命名账号";
  const status = publishEnqueueLoginStatusLabel(input.sessionStatus);
  const published = formatPublishEnqueueLastPublishedAt(input.lastLoginAt ?? null);
  return `${name} · ${status} · 最近发布 ${published}`;
}

export const PUBLISH_ENQUEUE_SESSION_EXPIRED_HINT =
  "当前所选账号登录已失效，请在本地 GEO 发布客户端重新登录后再加入发布队列。";

export const PUBLISH_ENQUEUE_RELOGIN_ACTION_LABEL = "打开本地客户端重新登录";
