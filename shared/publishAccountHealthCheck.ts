import type { LocalAgentAccountStatusEntry } from "./localAgentAccountSync";
import { PUBLISH_PLATFORM_LABELS, type BindingPublishPlatform, isBindingPublishPlatform } from "./platformAccountVerify";

export type PublishAccountHealthAccount = {
  id: number;
  platform: BindingPublishPlatform;
  accountName: string;
  localProfileId: string | null;
  sessionStatus: string | null;
  lastLoginAt: Date | string | null;
};

export type PublishAccountHealthGroup = {
  platform: string;
  accounts: Array<{
    id: number;
    accountName: string;
    isEnabled: boolean;
    localProfileId: string | null;
    sessionStatus: string | null;
    lastLoginAt?: Date | string | null;
  }>;
};

export function isPublishAccountSessionExpired(sessionStatus: string | null | undefined): boolean {
  return sessionStatus === "expired";
}

export function collectExpiredPublishAccounts(
  groups: ReadonlyArray<PublishAccountHealthGroup>,
): PublishAccountHealthAccount[] {
  const out: PublishAccountHealthAccount[] = [];
  for (const group of groups) {
    if (!isBindingPublishPlatform(group.platform)) continue;
    for (const account of group.accounts ?? []) {
      if (!account.isEnabled) continue;
      if (!isPublishAccountSessionExpired(account.sessionStatus)) continue;
      out.push({
        id: account.id,
        platform: group.platform,
        accountName: account.accountName,
        localProfileId: account.localProfileId,
        sessionStatus: account.sessionStatus ?? null,
        lastLoginAt: account.lastLoginAt ?? null,
      });
    }
  }
  return out;
}

export function collectBoundProfileIdsForHealthCheck(
  groups: ReadonlyArray<PublishAccountHealthGroup>,
): string[] {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const account of group.accounts ?? []) {
      if (!account.isEnabled) continue;
      const profileId = account.localProfileId?.trim();
      if (profileId) ids.add(profileId);
    }
  }
  return [...ids];
}

export function filterSnapshotEntriesForProfiles(
  snapshots: ReadonlyArray<LocalAgentAccountStatusEntry>,
  profileIds: ReadonlyArray<string>,
): LocalAgentAccountStatusEntry[] {
  if (profileIds.length === 0) return [];
  const set = new Set(profileIds);
  return snapshots.filter(entry => set.has(entry.profileId));
}

export function formatPublishAccountLastValidAt(value: Date | string | null | undefined): string {
  if (!value) return "暂无记录";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "暂无记录";
  return d.toLocaleString("zh-CN");
}

export function publishAccountHealthPlatformLabel(platform: BindingPublishPlatform): string {
  return PUBLISH_PLATFORM_LABELS[platform];
}
