import { resolveLocalAgentDisplayNameFields } from "./zhihuNicknameDenylist";

export type LocalAgentAccountLoginStatus = "valid" | "invalid" | "unknown";
export type LocalAgentSyncBindingPlatform = "zhihu" | "sohu" | "toutiao" | "baijiahao" | "netease";
const LOCAL_AGENT_SYNC_BINDING_PLATFORMS: LocalAgentSyncBindingPlatform[] = [
  "zhihu",
  "sohu",
  "toutiao",
  "baijiahao",
  "netease",
];
function isLocalAgentSyncBindingPlatform(platform: string): platform is LocalAgentSyncBindingPlatform {
  return LOCAL_AGENT_SYNC_BINDING_PLATFORMS.includes(platform as LocalAgentSyncBindingPlatform);
}

export type LocalAgentAccountStatusEntry = {
  platform: string;
  profileId: string;
  displayName: string | null;
  displayNameVerified: boolean;
  loginStatus: LocalAgentAccountLoginStatus;
  lastCheckedAt: string;
};

export type LocalAgentAccountStatusPayload = {
  agentId: string;
  projectId?: number;
  accounts: LocalAgentAccountStatusEntry[];
};

export const LOCAL_AGENT_ACCOUNT_SYNC_PENDING_DISPLAY_NAME = "账号已登录";

/** Web/DB 占位昵称：不参与发布前昵称一致性阻断 */
export function isPendingAccountDisplayName(name: string | null | undefined): boolean {
  const t = (name ?? "").trim();
  if (!t) return false;
  if (t === LOCAL_AGENT_ACCOUNT_SYNC_PENDING_DISPLAY_NAME) return true;
  if (t === "昵称待识别") return true;
  if (t.endsWith("（账号已登录）")) return true;
  if (t.endsWith("（昵称待识别）")) return true;
  return false;
}

export function mapStoredSessionToLoginStatus(sessionStatus: string | null | undefined): LocalAgentAccountLoginStatus {
  if (sessionStatus === "active") return "valid";
  if (sessionStatus === "expired") return "invalid";
  return "unknown";
}

export function resolveSyncAccountDisplayName(entry: Pick<LocalAgentAccountStatusEntry, "displayName">): string {
  const name = entry.displayName?.trim();
  if (name) return name;
  return LOCAL_AGENT_ACCOUNT_SYNC_PENDING_DISPLAY_NAME;
}

export function isLocalAgentAccountEntryValid(entry: LocalAgentAccountStatusEntry): boolean {
  return entry.loginStatus === "valid" && isLocalAgentSyncBindingPlatform(entry.platform);
}

export function filterValidLocalAgentPlatforms(
  entries: LocalAgentAccountStatusEntry[],
): LocalAgentSyncBindingPlatform[] {
  const out = new Set<LocalAgentSyncBindingPlatform>();
  for (const entry of entries) {
    if (isLocalAgentAccountEntryValid(entry) && isLocalAgentSyncBindingPlatform(entry.platform)) {
      out.add(entry.platform);
    }
  }
  return LOCAL_AGENT_SYNC_BINDING_PLATFORMS.filter(p => out.has(p));
}

export function mapLocalStoredAccountToStatusEntry(account: {
  platform: string;
  profileId: string;
  accountName?: string | null;
  displayNameVerified?: boolean;
  sessionStatus?: string | null;
  lastCheckedAt?: string | null;
}): LocalAgentAccountStatusEntry {
  const { displayName, displayNameVerified } = resolveLocalAgentDisplayNameFields(account);
  return {
    platform: account.platform,
    profileId: account.profileId,
    displayName,
    displayNameVerified,
    loginStatus: mapStoredSessionToLoginStatus(account.sessionStatus),
    lastCheckedAt: account.lastCheckedAt ?? new Date().toISOString(),
  };
}
