import type { ServerHeartbeatPlatformAccountRow } from "@shared/localAgentConnectionStatus";
import { isPublishReadyPlatformAccount } from "@shared/publishReadiness";
import { flattenPlatformAccountsForServerHeartbeat } from "./localAgentServerContext";

type PlatformAccountGroup = {
  platform: string;
  accounts?: Array<{
    accountName?: string | null;
    isEnabled?: boolean | number | null;
    localProfileId?: string | null;
    localAgentId?: string | null;
    sessionStatus?: string | null;
    lastSessionCheckedAt?: string | Date | null;
    updatedAt?: string | Date | null;
  }> | null;
};

export function buildLocalAgentDownloadCardServerContext(groups: PlatformAccountGroup[]): {
  platformAccounts: ServerHeartbeatPlatformAccountRow[];
  boundPublishAccountCount: number;
} {
  const platformAccounts = flattenPlatformAccountsForServerHeartbeat(groups);
  let boundPublishAccountCount = 0;
  for (const group of groups) {
    for (const account of group.accounts ?? []) {
      if (
        isPublishReadyPlatformAccount({
          platform: group.platform,
          accountName: account.accountName,
          isEnabled: account.isEnabled,
          localProfileId: account.localProfileId,
          localAgentId: account.localAgentId,
          sessionStatus: account.sessionStatus,
        })
      ) {
        boundPublishAccountCount += 1;
      }
    }
  }
  return { platformAccounts, boundPublishAccountCount };
}
