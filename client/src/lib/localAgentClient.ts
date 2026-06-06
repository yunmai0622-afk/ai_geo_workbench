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

const LOCAL_AGENT_UNAVAILABLE_MESSAGE = "无法连接本地发布客户端";

/** 合并多组件同时触发的健康探测，避免重复请求 */
const HEALTH_PROBE_CACHE_MS = 2500;
let healthProbeCache: { at: number; value: LocalAgentHealth | null } | null = null;

export function resetLocalAgentHealthProbeCache(): void {
  healthProbeCache = null;
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
  const now = Date.now();
  if (
    !options?.force &&
    healthProbeCache &&
    now - healthProbeCache.at < HEALTH_PROBE_CACHE_MS
  ) {
    return healthProbeCache.value;
  }

  let value: LocalAgentHealth | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(LOCAL_AGENT_DIRECT_HEALTH_URL, {
      signal: controller.signal,
      mode: "cors",
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as LocalAgentHealth;
      value = data.ok ? data : null;
    }
  } catch {
    value = null;
  }

  healthProbeCache = { at: now, value };
  return value;
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
