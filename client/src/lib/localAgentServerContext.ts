import type { ServerHeartbeatPlatformAccountRow } from "@shared/localAgentConnectionStatus";

type PlatformAccountGroup = {
  platform: string;
  accounts?: Array<{
    localAgentId?: string | null;
    localProfileId?: string | null;
    sessionStatus?: string | null;
    lastSessionCheckedAt?: string | Date | null;
  }> | null;
};

/** 从平台账号列表提取服务端心跳判断所需字段 */
export function flattenPlatformAccountsForServerHeartbeat(
  groups: PlatformAccountGroup[],
): ServerHeartbeatPlatformAccountRow[] {
  const rows: ServerHeartbeatPlatformAccountRow[] = [];
  for (const group of groups) {
    for (const account of group.accounts ?? []) {
      rows.push({
        localAgentId: account.localAgentId,
        localProfileId: account.localProfileId,
        sessionStatus: account.sessionStatus,
        lastSessionCheckedAt: account.lastSessionCheckedAt,
      });
    }
  }
  return rows;
}
