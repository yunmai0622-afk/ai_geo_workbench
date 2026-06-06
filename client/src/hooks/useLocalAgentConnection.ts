import type { LocalAgentStatusSnapshot } from "@/components/publishing/LocalAgentStatusCard";
import {
  checkLocalAgentHealth,
  listLocalAgentAccountSnapshots,
  type LocalAgentHealth,
} from "@/lib/localAgentClient";
import type { LocalAgentAccountStatusEntry } from "@shared/localAgentAccountSync";
import {
  readCachedLocalAgentConnectionStatus,
  resolveConnectionStatusAfterHealthProbe,
  writeCachedLocalAgentConnectionStatus,
  type LocalAgentConnectionStatus,
} from "@shared/localAgentConnectionStatus";
import { useCallback, useMemo, useState } from "react";

export type LocalAgentConnectionCheckResult = {
  status: LocalAgentConnectionStatus;
  health: LocalAgentHealth | null;
  online: boolean;
  accountSnapshot: LocalAgentAccountStatusEntry[];
};

export function useLocalAgentConnection(input: {
  boundPublishAccountCount: number;
  boundPlatformCount?: number | null;
  pendingTaskCount?: number | null;
}) {
  const [status, setStatus] = useState<LocalAgentConnectionStatus>(
    () => readCachedLocalAgentConnectionStatus() ?? "UNKNOWN",
  );
  const [checking, setChecking] = useState(false);
  const [clientVersion, setClientVersion] = useState<string | null>(null);
  const [accountSnapshot, setAccountSnapshot] = useState<LocalAgentAccountStatusEntry[]>([]);

  const localAgentConnectedOnline =
    status === "CONNECTED" || status === "CONNECTED_ACCOUNT_NOT_SYNCED";

  const localAgentOnline: boolean | null = localAgentConnectedOnline
    ? true
    : status === "DISCONNECTED" || status === "ERROR"
      ? false
      : null;

  const checkConnection = useCallback(async (): Promise<LocalAgentConnectionCheckResult> => {
    setStatus("CHECKING");
    setChecking(true);
    try {
      const health = await checkLocalAgentHealth({ force: true });
      let snapshot: LocalAgentAccountStatusEntry[] = [];
      let accountSnapshotCount = 0;
      if (health?.ok) {
        snapshot = await listLocalAgentAccountSnapshots();
        accountSnapshotCount = snapshot.length;
      }
      const version = health?.version?.trim() ? health.version.trim() : null;
      setClientVersion(version);
      setAccountSnapshot(snapshot);
      const nextStatus = resolveConnectionStatusAfterHealthProbe({
        ok: Boolean(health?.ok),
        accountSnapshotCount,
        boundPublishAccountCount: input.boundPublishAccountCount,
      });
      setStatus(nextStatus);
      writeCachedLocalAgentConnectionStatus(nextStatus);
      return {
        status: nextStatus,
        health,
        online: Boolean(health?.ok),
        accountSnapshot: snapshot,
      };
    } catch {
      const nextStatus = resolveConnectionStatusAfterHealthProbe({
        ok: false,
        accountSnapshotCount: 0,
        boundPublishAccountCount: input.boundPublishAccountCount,
        probeThrew: true,
      });
      setStatus(nextStatus);
      writeCachedLocalAgentConnectionStatus(nextStatus);
      setClientVersion(null);
      setAccountSnapshot([]);
      return {
        status: nextStatus,
        health: null,
        online: false,
        accountSnapshot: [],
      };
    } finally {
      setChecking(false);
    }
  }, [input.boundPublishAccountCount]);

  const statusSnapshot = useMemo((): LocalAgentStatusSnapshot => {
    const connected =
      status === "CONNECTED" || status === "CONNECTED_ACCOUNT_NOT_SYNCED"
        ? true
        : status === "DISCONNECTED" || status === "ERROR"
          ? false
          : null;
    return {
      connected,
      browserReady: connected,
      boundPlatformCount: input.boundPlatformCount ?? null,
      pendingTaskCount: input.pendingTaskCount ?? null,
    };
  }, [input.boundPlatformCount, input.pendingTaskCount, status]);

  return {
    status,
    statusSnapshot,
    checking,
    checkConnection,
    clientVersion,
    accountSnapshot,
    localAgentConnectedOnline,
    localAgentOnline,
  };
}
