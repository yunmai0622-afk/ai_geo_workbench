/** GEO Web SPA 路径（须与 client/src/App.tsx 路由一致） */
export const GEO_WEB_PATH_PRICING = "/pricing";
export const GEO_WEB_PATH_AI_DIAGNOSIS = "/ai-diagnosis";
export const GEO_WEB_PATH_CONTENT_PRODUCTION = "/weekly";
export const GEO_WEB_PATH_PUBLISH_RECORDS = "/content-publishing";
export const GEO_WEB_PATH_PLATFORM_ACCOUNTS = "/enterprise-profile#publish-platform-accounts";

/** 历史错误路径，仅用于兼容重定向 */
export const GEO_WEB_PATH_LEGACY_ASSET_CENTER = "/asset-center";

export type GeoWebNavigationTarget = "contentProduction" | "publishRecords" | "platformAccounts";

const TARGET_PATHS: Record<GeoWebNavigationTarget, string> = {
  contentProduction: GEO_WEB_PATH_CONTENT_PRODUCTION,
  publishRecords: GEO_WEB_PATH_PUBLISH_RECORDS,
  platformAccounts: GEO_WEB_PATH_PLATFORM_ACCOUNTS,
};

export function buildGeoWebUrl(serverUrl: string, path: string): string {
  const base = serverUrl.trim().replace(/\/$/, "");
  if (!base) throw new Error("serverUrl 未配置");
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function resolveGeoWebPath(target: GeoWebNavigationTarget): string {
  return TARGET_PATHS[target];
}

export function buildGeoWebUrlForTarget(serverUrl: string, target: GeoWebNavigationTarget): string {
  return buildGeoWebUrl(serverUrl, resolveGeoWebPath(target));
}

/** 与 client buildProjectUrl 一致：为项目上下文附加 ?projectId= */
export function buildProjectScopedPath(path: string, projectId: number): string {
  const basePath = path.split("?")[0] || "/";
  return `${basePath}?projectId=${projectId}`;
}

export function buildProjectScopedUrl(serverUrl: string, path: string, projectId: number): string {
  return buildGeoWebUrl(serverUrl, buildProjectScopedPath(path, projectId));
}
