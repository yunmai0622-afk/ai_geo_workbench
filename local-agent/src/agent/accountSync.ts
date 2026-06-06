import { readAgentConfig } from "./agentConfig";
import { readAccounts } from "./storage";

type LocalAgentAccountLoginStatus = "valid" | "invalid" | "unknown";
type LocalAgentAccountStatusEntry = {
  platform: string;
  profileId: string;
  displayName: string | null;
  displayNameVerified: boolean;
  loginStatus: LocalAgentAccountLoginStatus;
  lastCheckedAt: string;
};
type LocalAgentAccountStatusPayload = {
  agentId: string;
  projectId?: number;
  accounts: LocalAgentAccountStatusEntry[];
};

function mapStoredSessionToLoginStatus(sessionStatus: string | null | undefined): LocalAgentAccountLoginStatus {
  if (sessionStatus === "active") return "valid";
  if (sessionStatus === "expired") return "invalid";
  return "unknown";
}

function isBlockedDisplayName(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (!t || t.length < 2) return true;
  const deny = ["广告", "知乎", "首页", "推荐", "热榜", "关注", "会员", "创作中心", "私信", "通知", "用户", "账号", "登录", "设置", "博丽灵梦"];
  if (deny.includes(t)) return true;
  return /^https?:\/\//i.test(t);
}

function mapLocalStoredAccountToStatusEntry(account: {
  platform: string;
  profileId: string;
  accountName?: string | null;
  displayNameVerified?: boolean;
  sessionStatus?: string | null;
  lastCheckedAt?: string | null;
}): LocalAgentAccountStatusEntry {
  const verified = account.displayNameVerified === true && Boolean(account.accountName?.trim()) && !isBlockedDisplayName(account.accountName);
  return {
    platform: account.platform,
    profileId: account.profileId,
    displayName: verified ? account.accountName!.trim() : null,
    displayNameVerified: verified,
    loginStatus: mapStoredSessionToLoginStatus(account.sessionStatus),
    lastCheckedAt: account.lastCheckedAt ?? new Date().toISOString(),
  };
}

function headers(apiKey: string): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (apiKey.trim()) h["x-agent-api-key"] = apiKey.trim();
  return h;
}

async function trpcMutation<T>(procedure: string, input: unknown): Promise<T> {
  const { serverUrl, agentApiKey } = readAgentConfig();
  const url = `${serverUrl}/api/trpc/${procedure}`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(agentApiKey),
    body: JSON.stringify({ json: input }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`账号状态同步失败 HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  const body = (await res.json()) as {
    result?: { data?: { json?: T } };
    error?: { json?: { message?: string } };
  };
  if (body.error?.json?.message) throw new Error(body.error.json.message);
  const data = body.result?.data?.json;
  if (data === undefined) throw new Error("账号状态同步返回格式异常");
  return data;
}

async function postRestStatus(payload: LocalAgentAccountStatusPayload): Promise<{ synced: number }> {
  const { serverUrl, agentApiKey } = readAgentConfig();
  const res = await fetch(`${serverUrl}/api/local-agent/accounts/status`, {
    method: "POST",
    headers: headers(agentApiKey),
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as { success?: boolean; synced?: number; message?: string };
  if (!res.ok || body.success === false) {
    throw new Error(body.message ?? `账号状态同步失败 HTTP ${res.status}`);
  }
  return { synced: body.synced ?? 0 };
}

export async function syncAccountStatusesToServer(input?: {
  projectId?: number;
  profileIds?: string[];
}): Promise<{ ok: boolean; synced: number; skipped?: string }> {
  const cfg = readAgentConfig();
  if (!cfg.agentApiKey?.trim()) {
    return { ok: false, synced: 0, skipped: "no_api_key" };
  }
  if (!input?.projectId) {
    return { ok: false, synced: 0, skipped: "no_project_id" };
  }

  let accounts = readAccounts().accounts;
  if (input.profileIds?.length) {
    const set = new Set(input.profileIds);
    accounts = accounts.filter(a => set.has(a.profileId));
  }

  const payload: LocalAgentAccountStatusPayload = {
    agentId: cfg.localAgentId,
    projectId: input.projectId,
    accounts: accounts.map(mapLocalStoredAccountToStatusEntry),
  };

  if (payload.accounts.length === 0) {
    return { ok: true, synced: 0 };
  }

  try {
    const viaTrpc = await trpcMutation<{ success: true; synced: number }>("agent.syncAccountStatuses", payload);
    return { ok: true, synced: viaTrpc.synced };
  } catch {
    const viaRest = await postRestStatus(payload);
    return { ok: true, synced: viaRest.synced };
  }
}

export async function syncAllActiveAccountsForProject(projectId: number): Promise<void> {
  const active = readAccounts().accounts.filter(a => a.sessionStatus === "active");
  if (active.length === 0) return;
  await syncAccountStatusesToServer({ projectId, profileIds: active.map(a => a.profileId) });
}

export async function syncAccountAfterDetect(profileId: string): Promise<void> {
  const account = readAccounts().accounts.find(a => a.profileId === profileId);
  if (!account?.projectId) return;
  await syncAccountStatusesToServer({ projectId: account.projectId, profileIds: [profileId] });
}

export async function syncKnownProjectAccountStatuses(): Promise<void> {
  const groups = new Map<number, string[]>();
  for (const row of readAccounts().accounts) {
    if (!row.projectId) continue;
    const list = groups.get(row.projectId) ?? [];
    list.push(row.profileId);
    groups.set(row.projectId, list);
  }
  for (const [projectId, profileIds] of groups.entries()) {
    try {
      await syncAccountStatusesToServer({ projectId, profileIds });
    } catch {
      // 非阻断：本地发布能力可继续，下一次检测会重试同步
    }
  }
}

/** 与服务端心跳窗口对齐：连接成功后定期刷新 lastSessionCheckedAt */
const SERVER_HEARTBEAT_SYNC_INTERVAL_MS = 2 * 60 * 1000;
let lastServerHeartbeatSyncAt = 0;

/** Agent 与服务端建立连接后，将账号状态同步到 project_platform_accounts（服务端心跳） */
export async function syncServerHeartbeatOnConnect(options?: { force?: boolean }): Promise<void> {
  const now = Date.now();
  if (!options?.force && now - lastServerHeartbeatSyncAt < SERVER_HEARTBEAT_SYNC_INTERVAL_MS) {
    return;
  }
  lastServerHeartbeatSyncAt = now;
  await syncKnownProjectAccountStatuses();
}
