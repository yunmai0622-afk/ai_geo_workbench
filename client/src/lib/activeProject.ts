const STORAGE_KEY = "activeProjectId";

/** 无效 / 已删除 projectId 时 toast 与重定向文案 */
export const INVALID_PROJECT_MESSAGE = "项目不存在";

export function isProjectIdAccessible(
  projectId: number | null | undefined,
  projects: readonly { id: number }[],
): boolean {
  if (projectId == null || !Number.isFinite(projectId) || projectId <= 0) return false;
  return projects.some(p => p.id === projectId);
}

export function getProjectIdFromSearch(search: string): number | null {
  const normalized = search.startsWith("?") ? search : search ? `?${search}` : "";
  if (!normalized) return null;
  const raw = new URLSearchParams(normalized).get("projectId");
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function getProjectIdFromUrl(searchOverride?: string): number | null {
  if (typeof window === "undefined") return null;
  const search = searchOverride ?? window.location.search;
  return getProjectIdFromSearch(search);
}

export function getActiveProjectIdFromStorage(): number | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** URL projectId 优先，其次 sessionStorage；禁止 fallback 到 projects[0] */
export function getActiveProjectId(options?: { skipUrl?: boolean; search?: string }): number | null {
  if (!options?.skipUrl) {
    const fromUrl = getProjectIdFromUrl(options?.search);
    if (fromUrl) return fromUrl;
  }
  return getActiveProjectIdFromStorage();
}

export function parseProjectId(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const id = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function setActiveProjectId(projectId: number | string): void {
  const id = parseProjectId(projectId);
  if (!id) return;
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, String(id));
  }
}

/** 从 URL 读取 projectId 并写入 sessionStorage（URL 优先） */
export function syncActiveProjectIdFromUrl(search?: string): number | null {
  const fromUrl = getProjectIdFromUrl(search);
  if (fromUrl) {
    setActiveProjectId(fromUrl);
    return fromUrl;
  }
  return getActiveProjectIdFromStorage();
}

export function clearActiveProjectId(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function buildProjectUrl(path: string, projectId?: number | null): string {
  const basePath = path.split("?")[0] || "/";
  if (!projectId) return basePath;
  return `${basePath}?projectId=${projectId}`;
}

export function getPathnameFromLocation(location: string): string {
  return location.split("?")[0] || location;
}

export function getSearchFromLocation(location: string): string {
  if (location.includes("?")) return location.slice(location.indexOf("?"));
  if (typeof window !== "undefined") return window.location.search;
  return "";
}
