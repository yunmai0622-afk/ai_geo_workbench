import {
  checkLocalAgentHealth,
  detectLocalAgentAccount,
  listLocalAgentAccountSnapshots,
} from "@/lib/localAgentClient";
import { trpc } from "@/lib/trpc";
import {
  collectBoundProfileIdsForHealthCheck,
  filterSnapshotEntriesForProfiles,
} from "@shared/publishAccountHealthCheck";
import { useCallback, useRef, useState } from "react";

type RunOptions = {
  /** 是否对绑定账号执行本地 detect（打开页时默认 true） */
  detectSessions?: boolean;
};

/**
 * 发布页打开时：检测本地 Agent → 对绑定 profile 执行登录态检测 → 同步快照到 Web。
 */
export function usePublishAccountHealthCheck(projectId: number | null, enabled: boolean) {
  const utils = trpc.useUtils();
  const syncSnapshot = trpc.geo.platformAccounts.syncLocalAgentSnapshot.useMutation();
  const [checking, setChecking] = useState(false);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const runIdRef = useRef(0);

  const runCheck = useCallback(
    async (options?: RunOptions) => {
      if (!projectId || !enabled) return;
      const runId = ++runIdRef.current;
      setChecking(true);
      try {
        const groups =
          (await utils.geo.platformAccounts.list.fetch({ projectId }))?.accounts ?? [];
        const profileIds = collectBoundProfileIdsForHealthCheck(groups);

        const health = await checkLocalAgentHealth();
        const online = Boolean(health?.ok);
        if (runId !== runIdRef.current) return;
        setAgentOnline(prev => (prev === online ? prev : online));

        if (!online || !health) {
          setLastCheckedAt(new Date());
          return;
        }

        if (options?.detectSessions !== false && profileIds.length > 0) {
          for (const profileId of profileIds) {
            if (runId !== runIdRef.current) return;
            try {
              await detectLocalAgentAccount(profileId);
            } catch {
              // 单账号检测失败不阻断其余账号与同步
            }
          }
        }

        const snapshots = await listLocalAgentAccountSnapshots();
        if (runId !== runIdRef.current) return;
        const entries = filterSnapshotEntriesForProfiles(snapshots, profileIds);
        if (entries.length > 0) {
          await syncSnapshot.mutateAsync({
            agentId: health.agentId,
            projectId,
            accounts: entries,
          });
          await utils.geo.platformAccounts.list.invalidate({ projectId });
        }
        setLastCheckedAt(new Date());
      } finally {
        if (runId === runIdRef.current) {
          setChecking(false);
        }
      }
    },
    [enabled, projectId, syncSnapshot, utils.geo.platformAccounts.list],
  );

  return {
    checking,
    agentOnline,
    lastCheckedAt,
    runCheck,
  };
}
