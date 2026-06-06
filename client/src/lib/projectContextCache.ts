import { isLegacyOrphanProjectId, LEGACY_ORPHAN_PROJECT_ID } from "@shared/projectNavigation";

/** localStorage：项目上下文缓存世代号，升级时清除 session 中的旧 activeProjectId */
export const PROJECT_CONTEXT_CACHE_VERSION = "v2";

const CACHE_VERSION_KEY = "geoProjectContextCacheVersion";
const ACTIVE_PROJECT_STORAGE_KEY = "activeProjectId";

const SESSION_PROJECT_KEYS = [ACTIVE_PROJECT_STORAGE_KEY] as const;

export { LEGACY_ORPHAN_PROJECT_ID, isLegacyOrphanProjectId };

function clearSessionProjectKeys(): void {
  if (typeof window === "undefined") return;
  for (const key of SESSION_PROJECT_KEYS) {
    sessionStorage.removeItem(key);
  }
}

function readProjectIdFromSearch(search: string): number | null {
  const normalized = search.startsWith("?") ? search : search ? `?${search}` : "";
  if (!normalized) return null;
  const raw = new URLSearchParams(normalized).get("projectId");
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function readProjectIdFromUrl(): number | null {
  if (typeof window === "undefined") return null;
  return readProjectIdFromSearch(window.location.search);
}

function readActiveProjectIdFromStorage(): number | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** 从当前地址栏移除 ?projectId=30001，避免首屏仍用脏 URL 打 API */
export function stripLegacyOrphanProjectIdFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  const raw = url.searchParams.get("projectId");
  if (!raw) return false;
  const id = Number.parseInt(raw, 10);
  if (!isLegacyOrphanProjectId(id)) return false;
  url.searchParams.delete("projectId");
  const search = url.searchParams.toString();
  const next = `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
  window.history.replaceState(null, "", next);
  return true;
}

export type ProjectContextCacheNukeResult = {
  nuked: boolean;
  reasons: string[];
};

/**
 * 应用启动时调用：升级 cacheVersion 到 v2、清除 session 中的 30001、剥离 URL 上的 30001。
 * 须在 React 首屏渲染前执行（见 main.tsx）。
 */
export function nukeStaleProjectContextCache(): ProjectContextCacheNukeResult {
  if (typeof window === "undefined") {
    return { nuked: false, reasons: [] };
  }

  const reasons: string[] = [];

  const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
  if (storedVersion !== PROJECT_CONTEXT_CACHE_VERSION) {
    clearSessionProjectKeys();
    localStorage.setItem(CACHE_VERSION_KEY, PROJECT_CONTEXT_CACHE_VERSION);
    reasons.push("cache_version_upgrade");
  }

  if (isLegacyOrphanProjectId(readActiveProjectIdFromStorage())) {
    clearSessionProjectKeys();
    reasons.push("legacy_session_30001");
  }

  if (isLegacyOrphanProjectId(readProjectIdFromUrl())) {
    clearSessionProjectKeys();
    reasons.push("legacy_url_30001");
  }

  if (stripLegacyOrphanProjectIdFromUrl()) {
    reasons.push("stripped_url_30001");
  }

  return { nuked: reasons.length > 0, reasons };
}
