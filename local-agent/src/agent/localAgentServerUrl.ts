/** 由 scripts/sync-server-url-module.mjs 从 shared/localAgentServerUrl.ts 同步，请勿手改 */
/** GEO 本地发布客户端 — 默认 GEO Web 服务地址（与 downloads/manifest.json geoWebBaseUrl 对齐） */

export const LOCAL_AGENT_DEV_SERVER_URL = "http://127.0.0.1:3000";

export const DEFAULT_GEO_WEB_BASE_URL = "https://aigeoworkbench00-production.up.railway.app";
export const LEGACY_GEO_WEB_BASE_URLS = [
  "https://aigeoworkb-kzxhj9uy.manus.space",
] as const;

function normalizeServerUrl(url: string | null | undefined): string {
  return (url ?? "").trim().toLowerCase().replace(/\/$/, "");
}

export function isLegacyDevServerUrl(url: string | null | undefined): boolean {
  const u = normalizeServerUrl(url);
  return (
    u === "http://127.0.0.1:3000" ||
    u === "http://localhost:3000" ||
    u === "https://127.0.0.1:3000" ||
    u === "https://localhost:3000"
  );
}

export function isLegacyProductionServerUrl(url: string | null | undefined): boolean {
  const u = normalizeServerUrl(url);
  return LEGACY_GEO_WEB_BASE_URLS.some(legacy => normalizeServerUrl(legacy) === u);
}

export function resolvePackagedDefaultServerUrl(
  geoWebBaseUrl?: string | null,
  isPackaged = true,
): string {
  if (!isPackaged) return LOCAL_AGENT_DEV_SERVER_URL;
  const fromManifest = typeof geoWebBaseUrl === "string" ? geoWebBaseUrl.trim() : "";
  if (/^https?:\/\//i.test(fromManifest)) return fromManifest.replace(/\/$/, "");
  return DEFAULT_GEO_WEB_BASE_URL.replace(/\/$/, "");
}

export function migrateAgentServerUrl(input: {
  serverUrl?: string | null;
  serverUrlUserConfigured?: boolean | null;
  isPackaged: boolean;
  geoWebBaseUrl?: string | null;
}): { serverUrl: string; serverUrlUserConfigured: boolean; migrated: boolean } {
  const defaultUrl = resolvePackagedDefaultServerUrl(input.geoWebBaseUrl, input.isPackaged);
  const userConfigured = Boolean(input.serverUrlUserConfigured);
  const current = (input.serverUrl ?? "").trim().replace(/\/$/, "");

  if (userConfigured && current) {
    return { serverUrl: current, serverUrlUserConfigured: true, migrated: false };
  }

  if (!current) {
    return { serverUrl: defaultUrl, serverUrlUserConfigured: false, migrated: true };
  }

  if (input.isPackaged && isLegacyDevServerUrl(current)) {
    return { serverUrl: defaultUrl, serverUrlUserConfigured: false, migrated: true };
  }

  if (input.isPackaged && !userConfigured && isLegacyProductionServerUrl(current)) {
    return { serverUrl: defaultUrl, serverUrlUserConfigured: false, migrated: true };
  }

  if (!input.isPackaged && isLegacyDevServerUrl(current)) {
    return { serverUrl: LOCAL_AGENT_DEV_SERVER_URL, serverUrlUserConfigured: false, migrated: false };
  }

  return { serverUrl: current, serverUrlUserConfigured: userConfigured, migrated: false };
}

export function formatGeoServerConnectionError(
  error: unknown,
  serverUrl: string,
): { userMessage: string; diagnosticDetail: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const url = serverUrl.trim();
  const isFetchFailed = /fetch failed/i.test(raw);

  if (!url) {
    return {
      userMessage: "请先配置 GEO 服务地址。",
      diagnosticDetail: raw,
    };
  }

  if (isLegacyDevServerUrl(url)) {
    return {
      userMessage: "当前客户端正在连接本地开发地址，线上使用请切换为 GEO 线上服务地址。",
      diagnosticDetail: raw,
    };
  }

  if (isFetchFailed || /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i.test(raw)) {
    return {
      userMessage: "无法连接 GEO 服务，请检查网络或稍后重试。",
      diagnosticDetail: raw,
    };
  }

  return { userMessage: raw, diagnosticDetail: raw };
}
