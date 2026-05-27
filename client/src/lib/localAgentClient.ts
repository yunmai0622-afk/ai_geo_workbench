import { LOCAL_AGENT_BASE_URL } from "@shared/localAgent";
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

async function agentFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${LOCAL_AGENT_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T & { message?: string };
  if (!res.ok) {
    const err = new Error((data as { message?: string }).message ?? `Agent HTTP ${res.status}`);
    (err as Error & { status: number; data: unknown }).status = res.status;
    (err as Error & { data: unknown }).data = data;
    throw err;
  }
  return data;
}

export async function checkLocalAgentHealth(): Promise<LocalAgentHealth | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${LOCAL_AGENT_BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as LocalAgentHealth;
    return data.ok ? data : null;
  } catch {
    return null;
  }
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
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "无法连接本地发布客户端",
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
    throw e;
  }
}

export async function listLocalAgentAccountSnapshots(): Promise<LocalAgentAccountStatusEntry[]> {
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
}
