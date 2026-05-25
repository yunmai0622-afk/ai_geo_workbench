import { readAgentConfig } from "./agentConfig";

/** 与仓库根目录 shared/geoWebPaths.ts 保持同步 */
export const GEO_WEB_PATH_CONTENT_PRODUCTION = "/weekly";
export const GEO_WEB_PATH_PUBLISH_RECORDS = "/content-publishing";
export const GEO_WEB_PATH_PLATFORM_ACCOUNTS = "/enterprise-profile#platform-accounts";

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

export function resolveGeoWebUrl(target: GeoWebNavigationTarget): string {
  const { serverUrl } = readAgentConfig();
  return buildGeoWebUrl(serverUrl, TARGET_PATHS[target]);
}
