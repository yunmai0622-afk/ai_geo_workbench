import {
  isBindingPublishPlatform,
  publishBlockedNoAccountMessage,
  publishBlockedNoLocalProfileMessage,
  publishBlockedSessionExpiredMessage,
  type BindingPublishPlatform,
} from "@shared/platformAccountVerify";
import type { PublishPagePlatformCard } from "@shared/publishPageLayout";
import { isPublishReadyPlatformAccount } from "@shared/publishReadiness";

type AccountGroup = {
  platform: string;
  accounts: Array<{
    id: number;
    accountName: string;
    isEnabled: boolean;
    localProfileId?: string | null;
    sessionStatus?: string | null;
  }>;
};

export function pickReadyAccountForPlatform(
  groups: ReadonlyArray<AccountGroup>,
  slug: BindingPublishPlatform,
): { id: number; accountName: string } | null {
  const group = groups.find(g => g.platform === slug);
  const ready = (group?.accounts ?? []).filter(a =>
    isPublishReadyPlatformAccount({ ...a, platform: slug }),
  );
  const first = ready[0];
  if (!first) return null;
  return { id: first.id, accountName: first.accountName };
}

export function publishBlockedReasonForPlatform(
  groups: ReadonlyArray<AccountGroup>,
  slug: BindingPublishPlatform,
): string | null {
  const group = groups.find(g => g.platform === slug);
  const enabled = (group?.accounts ?? []).filter(a => a.isEnabled);
  if (enabled.some(a => !String(a.localProfileId ?? "").trim())) {
    return publishBlockedNoLocalProfileMessage(slug);
  }
  if (enabled.some(a => a.sessionStatus !== "active")) {
    return publishBlockedSessionExpiredMessage(slug);
  }
  return publishBlockedNoAccountMessage(slug);
}

export function resolveEnqueuePlatformSlug(
  card: PublishPagePlatformCard,
): BindingPublishPlatform | null {
  if (!card.publishQueueSlug || !isBindingPublishPlatform(card.publishQueueSlug)) {
    return null;
  }
  return card.publishQueueSlug;
}

export function isLocalAgentPublishTaskResult(res: { publishMode?: string | null }): boolean {
  return res.publishMode === "local_agent";
}
