import type { LocalAgentStatusSnapshot } from "@/components/publishing/LocalAgentStatusCard";
import {
  checkLocalAgentHealth,
  listLocalAgentAccountSnapshots,
  type LocalAgentHealth,
} from "@/lib/localAgentClient";
import type { LocalAgentAccountStatusEntry } from "@shared/localAgentAccountSync";
import {
  inferServerHeartbeatFromPlatformAccounts,
  isLocalAgentResolvedConnected,
  localAgentConnectionCheckFeedback,
  mapResolvedStateToConnectionStatus,
  readCachedLocalAgentConnectionStatus,
  resolveConnectionStatusAfterHealthProbe,
  resolveLocalAgentConnectionState,
  writeCachedLocalAgentConnectionStatus,
  type LocalAgentConnectionStatus,
  type LocalAgentResolvedConnectionState,
  type ServerHeartbeatPlatformAccountRow,
} from "@shared/localAgentConnectionStatus";
import { useCallback, useMemo, useState } from "react";

export type LocalAgentConnectionCheckResult = {
  status: LocalAgentConnectionStatus;
  resolvedState: LocalAgentResolvedConnectionState;
  health: LocalAgentHealth | null;
  online: boolean;
  accountSnapshot: LocalAgentAccountStatusEntry[];
  feedback: ReturnType<typeof localAgentConnectionCheckFeedback>;
};

export function useLocalAgentConnection(input: {
  boundPublishAccountCount: number;
  boundPlatformCount?: number | null;
  pendingTaskCount?: number | null;
  platformAccounts?: ServerHeartbeatPlatformAccountRow[];
}) {
  const [probeStatus, setProbeStatus] = useState<LocalAgentConnectionStatus>(
    () => readCachedLocalAgentConnectionStatus() ?? "UNKNOWN",
  );
  const [checking, setChecking] = useState(false);
  const [clientVersion, setClientVersion] = useState<string | null>(null);
  const [accountSnapshot, setAccountSnapshot] = useState<LocalAgentAccountStatusEntry[]>([]);
  const [lastLocalHttpOk, setLastLocalHttpOk] = useState<boolean | null>(null);
  const [lastLocalHttpProbeThrew, setLastLocalHttpProbeThrew] = useState(false);

  const serverHeartbeat = useMemo(
    () => inferServerHeartbeatFromPlatformAccounts(input.platformAccounts),
    [input.platformAccounts],
  );

  const resolvedState = useMemo(
    () =>
      resolveLocalAgentConnectionState({
        serverHeartbeatConnected: serverHeartbeat.connected,
        serverLastActivityAt: serverHeartbeat.lastActivityAt,
        platformAccounts: input.platformAccounts,
        localHttpCheckResult: lastLocalHttpOk,
        localHttpProbeThrew: lastLocalHttpProbeThrew,
        localAgentAccountSnapshot: accountSnapshot,
        boundPublishAccountCount: input.boundPublishAccountCount,
      }),
    [
      accountSnapshot,
      input.boundPublishAccountCount,
      input.platformAccounts,
      lastLocalHttpOk,
      lastLocalHttpProbeThrew,
      serverHeartbeat.connected,
      serverHeartbeat.lastActivityAt,
    ],
  );

  const status = useMemo(
    () => mapResolvedStateToConnectionStatus(resolvedState, probeStatus),
    [probeStatus, resolvedState],
  );

  const localAgentConnectedOnline = isLocalAgentResolvedConnected(resolvedState);

  const localAgentOnline: boolean | null = localAgentConnectedOnline
    ? true
    : resolvedState === "DISCONNECTED" || resolvedState === "CHECK_FAILED"
      ? false
      : lastLocalHttpOk;

  const checkConnection = useCallback(async (): Promise<LocalAgentConnectionCheckResult> => {
    setProbeStatus("CHECKING");
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
      const localOk = Boolean(health?.ok);
      setLastLocalHttpOk(localOk);
      setLastLocalHttpProbeThrew(false);
      const nextProbeStatus = resolveConnectionStatusAfterHealthProbe({
        ok: localOk,
        accountSnapshotCount,
        boundPublishAccountCount: input.boundPublishAccountCount,
      });
      const nextResolved = resolveLocalAgentConnectionState({
        serverHeartbeatConnected: serverHeartbeat.connected,
        serverLastActivityAt: serverHeartbeat.lastActivityAt,
        platformAccounts: input.platformAccounts,
        localHttpCheckResult: localOk,
        localHttpProbeThrew: false,
        localAgentAccountSnapshot: snapshot,
        boundPublishAccountCount: input.boundPublishAccountCount,
      });
      const nextStatus = mapResolvedStateToConnectionStatus(nextResolved, nextProbeStatus);
      setProbeStatus(nextProbeStatus);
      writeCachedLocalAgentConnectionStatus(nextProbeStatus);
      const feedback = localAgentConnectionCheckFeedback(nextResolved, {
        localHttpCheckResult: localOk,
      });
      return {
        status: nextStatus,
        resolvedState: nextResolved,
        health,
        online: isLocalAgentResolvedConnected(nextResolved),
        accountSnapshot: snapshot,
        feedback,
      };
    } catch {
      setLastLocalHttpOk(false);
      setLastLocalHttpProbeThrew(true);
      const nextProbeStatus = resolveConnectionStatusAfterHealthProbe({
        ok: false,
        accountSnapshotCount: 0,
        boundPublishAccountCount: input.boundPublishAccountCount,
        probeThrew: true,
      });
      const nextResolved = resolveLocalAgentConnectionState({
        serverHeartbeatConnected: serverHeartbeat.connected,
        serverLastActivityAt: serverHeartbeat.lastActivityAt,
        platformAccounts: input.platformAccounts,
        localHttpCheckResult: false,
        localHttpProbeThrew: true,
        localAgentAccountSnapshot: [],
        boundPublishAccountCount: input.boundPublishAccountCount,
      });
      const nextStatus = mapResolvedStateToConnectionStatus(nextResolved, nextProbeStatus);
      setProbeStatus(nextProbeStatus);
      writeCachedLocalAgentConnectionStatus(nextProbeStatus);
      setClientVersion(null);
      setAccountSnapshot([]);
      const feedback = localAgentConnectionCheckFeedback(nextResolved, {
        localHttpCheckResult: false,
      });
      return {
        status: nextStatus,
        resolvedState: nextResolved,
        health: null,
        online: isLocalAgentResolvedConnected(nextResolved),
        accountSnapshot: [],
        feedback,
      };
    } finally {
      setChecking(false);
    }
  }, [
    input.boundPublishAccountCount,
    input.platformAccounts,
    serverHeartbeat.connected,
    serverHeartbeat.lastActivityAt,
  ]);

  const statusSnapshot = useMemo((): LocalAgentStatusSnapshot => {
    const connected = localAgentConnectedOnline
      ? true
      : resolvedState === "DISCONNECTED" || resolvedState === "CHECK_FAILED"
        ? false
        : null;
    return {
      connected,
      browserReady: lastLocalHttpOk,
      boundPlatformCount: input.boundPlatformCount ?? null,
      pendingTaskCount: input.pendingTaskCount ?? null,
    };
  }, [
    input.boundPlatformCount,
    input.pendingTaskCount,
    lastLocalHttpOk,
    localAgentConnectedOnline,
    resolvedState,
  ]);

  return {
    status,
    resolvedState,
    statusSnapshot,
    checking,
    checkConnection,
    clientVersion,
    accountSnapshot,
    localAgentConnectedOnline,
    localAgentOnline,
    serverHeartbeatConnected: serverHeartbeat.connected,
  };
}
