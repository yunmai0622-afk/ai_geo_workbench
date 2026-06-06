import {
  LOCAL_AGENT_BASE_URL,
  LOCAL_AGENT_DIRECT_HEALTH_URL,
} from "@shared/localAgent";
import {
  mapLocalStoredAccountToStatusEntry,
  type LocalAgentAccountStatusEntry,
} from "@shared/localAgentAccountSync";

export type LocalAgentHealth = {
  ok: boolean;
  agentId: string;
  version: string;
  platform: string;
  startedAt: string;
};

export type CreateProfileResponse = {
  profileId: string;
  platform: string;
  sessionStatus: string;
};

export type DetectAccountResponse = {
  ok: boolean;
  profileId?: string;
  platform?: string;
  accountName?: string | null;
  sessionStatus?: string;
  errorType?: string;
  message?: string;
};

export type LocalAgentAccountSnapshotRow = {
  profileId: string;
  platform: string;
  projectId?: number | null;
  accountName: string | null;
  displayNameVerified?: boolean;
  sessionStatus: "unknown" | "active" | "expired";
  lastCheckedAt: string | null;
};

export type LocalAgentHealthProbeDebug = {
  healthUrl: string;
  fetchStatus: "ok" | "http_error" | "network_error";
  fetchErrorName?: string;
  fetchErrorMessage?: string;
  isCorsLikely: boolean;
  isPrivateNetworkLikely: boolean;
  responseStatus?: number;
  responseBodySummary?: string;
  preflightStatus?: number;
  preflightAllowOrigin?: string | null;
  preflightAllowPrivateNetwork?: string | null;
};

const LOCAL_AGENT_UNAVAILABLE_MESSAGE = "无法连接本地发布客户端";

/** 合并多组件同时触发的健康探测，避免重复请求 */
const HEALTH_PROBE_CACHE_MS = 2500;
let healthProbeCache: { at: number; value: LocalAgentHealth | null } | null = null;
let lastHealthProbeDebug: LocalAgentHealthProbeDebug | null = null;

export function resetLocalAgentHealthProbeCache(): void {
  healthProbeCache = null;
  lastHealthProbeDebug = null;
}

export function getLastLocalAgentHealthProbeDebug(): LocalAgentHealthProbeDebug | null {
  return lastHealthProbeDebug;
}

function resolveBrowserOrigin(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.location.origin;
}

function summarizeResponseBody(text: string, maxLen = 160): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "(empty)";
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
}

export function classifyLocalAgentFetchFailure(input: {
  fetchErrorName?: string;
  fetchErrorMessage?: string;
  pageOrigin?: string;
  preflightAllowOrigin?: string | null;
  preflightAllowPrivateNetwork?: string | null;
  preflightStatus?: number;
}): Pick<LocalAgentHealthProbeDebug, "isCorsLikely" | "isPrivateNetworkLikely"> {
  const message = `${input.fetchErrorName ?? ""} ${input.fetchErrorMessage ?? ""}`.toLowerCase();
  const preflightFailed =
    input.preflightStatus != null && (input.preflightStatus < 200 || input.preflightStatus >= 300);
  const missingPrivateNetwork = input.preflightAllowPrivateNetwork !== "true";
  const originMismatch =
    Boolean(input.pageOrigin) &&
    input.preflightAllowOrigin != null &&
    input.preflightAllowOrigin !== input.pageOrigin;
  const missingOrigin = Boolean(input.pageOrigin) && !input.preflightAllowOrigin;

  const isPrivateNetworkLikely =
    missingPrivateNetwork ||
    preflightFailed ||
    message.includes("private network") ||
    message.includes("local network");

  const isCorsLikely =
    missingOrigin ||
    originMismatch ||
    message.includes("cors") ||
    (message.includes("failed to fetch") && !isPrivateNetworkLikely);

  return { isCorsLikely, isPrivateNetworkLikely };
}

async function probeOptionsPreflight(
  url: string,
  origin: string | undefined,
): Promise<Pick<
  LocalAgentHealthProbeDebug,
  "preflightStatus" | "preflightAllowOrigin" | "preflightAllowPrivateNetwork"
>> {
  if (!origin) {
    return {
      preflightStatus: undefined,
      preflightAllowOrigin: null,
      preflightAllowPrivateNetwork: null,
    };
  }
  try {
    const res = await fetch(url, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Private-Network": "true",
      },
      cache: "no-store",
    });
    return {
      preflightStatus: res.status,
      preflightAllowOrigin: res.headers.get("access-control-allow-origin"),
      preflightAllowPrivateNetwork: res.headers.get("access-control-allow-private-network"),
    };
  } catch {
    return {
      preflightStatus: undefined,
      preflightAllowOrigin: null,
      preflightAllowPrivateNetwork: null,
    };
  }
}

export async function probeLocalAgentHealthDetailed(options?: {
  force?: boolean;
}): Promise<{ health: LocalAgentHealth | null; debug: LocalAgentHealthProbeDebug }> {
  const now = Date.now();
  if (
    !options?.force &&
    healthProbeCache &&
    now - healthProbeCache.at < HEALTH_PROBE_CACHE_MS &&
    lastHealthProbeDebug
  ) {
    return { health: healthProbeCache.value, debug: lastHealthProbeDebug };
  }

  const healthUrl = LOCAL_AGENT_DIRECT_HEALTH_URL;
  const pageOrigin = resolveBrowserOrigin();
  const preflight = await probeOptionsPreflight(healthUrl, pageOrigin);

  let health: LocalAgentHealth | null = null;
  let fetchStatus: LocalAgentHealthProbeDebug["fetchStatus"] = "network_error";
  let fetchErrorName: string | undefined;
  let fetchErrorMessage: string | undefined;
  let responseStatus: number | undefined;
  let responseBodySummary: string | undefined;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(healthUrl, {
      signal: controller.signal,
      mode: "cors",
      cache: "no-store",
    });
    clearTimeout(timer);
    responseStatus = res.status;
    const bodyText = await res.text();
    responseBodySummary = summarizeResponseBody(bodyText);
    if (res.ok) {
      try {
        const data = JSON.parse(bodyText) as LocalAgentHealth;
        health = data.ok ? data : null;
        fetchStatus = health ? "ok" : "http_error";
      } catch {
        fetchStatus = "http_error";
      }
    } else {
      fetchStatus = "http_error";
    }
  } catch (e) {
    fetchStatus = "network_error";
    fetchErrorName = e instanceof Error ? e.name : "Error";
    fetchErrorMessage = e instanceof Error ? e.message : String(e);
  }

  const { isCorsLikely, isPrivateNetworkLikely } = classifyLocalAgentFetchFailure({
    fetchErrorName,
    fetchErrorMessage,
    pageOrigin,
    preflightAllowOrigin: preflight.preflightAllowOrigin,
    preflightAllowPrivateNetwork: preflight.preflightAllowPrivateNetwork,
    preflightStatus: preflight.preflightStatus,
  });

  const debug: LocalAgentHealthProbeDebug = {
    healthUrl,
    fetchStatus,
    fetchErrorName,
    fetchErrorMessage,
    isCorsLikely,
    isPrivateNetworkLikely,
    responseStatus,
    responseBodySummary,
    ...preflight,
  };

  healthProbeCache = { at: now, value: health };
  lastHealthProbeDebug = debug;
  return { health, debug };
}

async function agentFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${LOCAL_AGENT_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(LOCAL_AGENT_UNAVAILABLE_MESSAGE);
  }
  let data: T & { message?: string };
  try {
    data = (await res.json()) as T & { message?: string };
  } catch {
    throw new Error(LOCAL_AGENT_UNAVAILABLE_MESSAGE);
  }
  if (!res.ok) {
    const raw = (data as { message?: string }).message;
    const err = new Error(
      raw && !looksLikeAgentInternalMessage(raw) ? raw : LOCAL_AGENT_UNAVAILABLE_MESSAGE,
    );
    (err as Error & { status: number; data: unknown }).status = res.status;
    (err as Error & { data: unknown }).data = data;
    throw err;
  }
  return data;
}

function looksLikeAgentInternalMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("127.0.0.1") ||
    lower.includes("localhost") ||
    lower.includes("39888") ||
    lower.includes("err_connection") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("econnrefused")
  );
}

export async function checkLocalAgentHealth(options?: {
  /** 用户点击「重试检测」等场景跳过短时缓存 */
  force?: boolean;
}): Promise<LocalAgentHealth | null> {
  const { health } = await probeLocalAgentHealthDetailed(options);
  return health;
}

export async function createPlatformProfile(input: {
  platform: "zhihu" | "sohu" | "baijiahao" | "toutiao" | "netease";
  projectId: number;
  accountRole?: string | null;
  accountGroup?: string | null;
}): Promise<CreateProfileResponse> {
  return agentFetch<CreateProfileResponse>("/profiles/create", {
    method: "POST",
    body: JSON.stringify({
      platform: input.platform,
      projectId: input.projectId,
      accountRole: input.accountRole ?? null,
      accountGroup: input.accountGroup ?? null,
    }),
  });
}

/** @deprecated 使用 createPlatformProfile */
export async function createZhihuProfile(input: {
  projectId: number;
  accountRole?: string | null;
  accountGroup?: string | null;
}): Promise<CreateProfileResponse> {
  return createPlatformProfile({ ...input, platform: "zhihu" });
}

export async function openLocalAgentLogin(profileId: string): Promise<{ ok: boolean; message: string }> {
  return agentFetch(`/profiles/${encodeURIComponent(profileId)}/open-login`, { method: "POST" });
}

export async function focusLocalAgentAccountsTab(): Promise<{ ok: boolean; message: string }> {
  try {
    return await agentFetch<{ ok: boolean; message: string }>("/ui/focus-accounts", { method: "POST" });
  } catch {
    return {
      ok: false,
      message: LOCAL_AGENT_UNAVAILABLE_MESSAGE,
    };
  }
}

export async function detectLocalAgentAccount(profileId: string): Promise<DetectAccountResponse> {
  try {
    return await agentFetch<DetectAccountResponse>(
      `/profiles/${encodeURIComponent(profileId)}/detect-account`,
      { method: "POST" },
    );
  } catch (e) {
    const data = (e as Error & { data?: DetectAccountResponse }).data;
    if (data && data.ok === false) return data;
    throw e instanceof Error && !looksLikeAgentInternalMessage(e.message)
      ? e
      : new Error(LOCAL_AGENT_UNAVAILABLE_MESSAGE);
  }
}

export async function listLocalAgentAccountSnapshots(): Promise<LocalAgentAccountStatusEntry[]> {
  try {
    const data = await agentFetch<{ accounts: LocalAgentAccountSnapshotRow[] }>("/accounts", {
      method: "GET",
    });
    return (data.accounts ?? []).map(acc =>
      mapLocalStoredAccountToStatusEntry({
        platform: acc.platform,
        profileId: acc.profileId,
        accountName: acc.accountName,
        displayNameVerified: acc.displayNameVerified,
        sessionStatus: acc.sessionStatus,
        lastCheckedAt: acc.lastCheckedAt,
      }),
    );
  } catch {
    return [];
  }
}
