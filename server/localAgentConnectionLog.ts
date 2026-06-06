import {
  inferServerHeartbeatFromPlatformAccounts,
  resolveLocalAgentConnectionState,
  type LocalAgentResolvedConnectionState,
  type ServerHeartbeatPlatformAccountRow,
} from "@shared/localAgentConnectionStatus";

export type LocalAgentConnectionLogFields = {
  projectId?: number | null;
  userId?: number | null;
  platform?: string | null;
  hasLocalAgentId?: boolean;
  hasLocalProfileId?: boolean;
  sessionStatus?: string | null;
  loginStatus?: string | null;
  lastCheckedAt?: string | null;
  resolvedState?: LocalAgentResolvedConnectionState | string;
  accountCount?: number;
  synced?: number;
  source?: string;
};

export function logLocalAgentConnection(tag: string, fields: LocalAgentConnectionLogFields): void {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    safe[key] = value;
  }
  console.info(`[geo.localAgent.${tag}]`, JSON.stringify(safe));
}

export function logResolvedLocalAgentConnectionState(input: {
  source: string;
  projectId: number;
  userId: number;
  platformAccounts: ServerHeartbeatPlatformAccountRow[];
}): LocalAgentResolvedConnectionState {
  const heartbeat = inferServerHeartbeatFromPlatformAccounts(input.platformAccounts);
  const resolvedState = resolveLocalAgentConnectionState({
    serverHeartbeatConnected: heartbeat.connected,
    serverLastActivityAt: heartbeat.lastActivityAt,
    platformAccounts: input.platformAccounts,
    localHttpCheckResult: null,
  });
  const activeRow = input.platformAccounts.find(
    row => row.localAgentId?.trim() && row.localProfileId?.trim() && row.sessionStatus === "active",
  );
  logLocalAgentConnection("resolveState", {
    source: input.source,
    projectId: input.projectId,
    userId: input.userId,
    platform: activeRow ? "multi" : null,
    hasLocalAgentId: Boolean(activeRow?.localAgentId?.trim()),
    hasLocalProfileId: Boolean(activeRow?.localProfileId?.trim()),
    sessionStatus: activeRow?.sessionStatus ?? null,
    lastCheckedAt:
      activeRow?.lastSessionCheckedAt != null
        ? new Date(activeRow.lastSessionCheckedAt).toISOString()
        : null,
    resolvedState,
    accountCount: input.platformAccounts.length,
  });
  return resolvedState;
}
