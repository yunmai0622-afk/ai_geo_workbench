import { Button } from "@/components/ui/button";
import { buildLocalAgentDownloadCardServerContext } from "@/lib/localAgentDownloadCardContext";
import { checkLocalAgentHealth, listLocalAgentAccountSnapshots } from "@/lib/localAgentClient";
import { trpc } from "@/lib/trpc";
import type { LocalAgentAccountStatusEntry } from "@shared/localAgentAccountSync";
import {
  buildLocalAgentConnectionDebugInfo,
  deriveLocalAgentUiConnectionStatus,
  inferServerHeartbeatFromPlatformAccounts,
  isLocalAgentResolvedConnected,
  localAgentConnectionCheckFeedback,
  localAgentConnectionCopy,
  localAgentDownloadCardConnectionDetail,
  LOCAL_AGENT_PROJECT_ACCOUNT_NOT_SYNCED_DETAIL,
  resolveConnectionStatusAfterHealthProbe,
  resolveLocalAgentConnectionState,
  type LocalAgentConnectionStatus,
  type LocalAgentResolvedConnectionState,
  type ServerHeartbeatPlatformAccountRow,
} from "@shared/localAgentConnectionStatus";
import { selectSnapshotEntriesForProjectSync } from "@shared/publishAccountHealthCheck";
import { Download, Loader2, RefreshCw, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type DownloadManifest = {
  macDmgUrl?: string | null;
  macZipUrl?: string | null;
  winZipUrl?: string | null;
  winSetupUrl?: string | null;
};

type Props = {
  /** 传入后卡片自行拉取平台账号，不依赖父组件 props 时序 */
  projectId?: number;
  platformAccounts?: ServerHeartbeatPlatformAccountRow[];
  boundPublishAccountCount?: number;
  localAgentAccountSnapshot?: LocalAgentAccountStatusEntry[];
};

function isValidDownloadUrl(url: string | null | undefined): url is string {
  if (!url?.trim()) return false;
  if (url.startsWith("http://") || url.startsWith("https://")) return true;
  return url.startsWith("/downloads/");
}

/** Mac zip：相对路径或绝对 HTTPS URL，禁止把 dmg/html 404 当 zip */
export function isMacZipDownloadUrl(url: string | null | undefined): url is string {
  if (!isValidDownloadUrl(url)) return false;
  return /\.zip(\?|$)/i.test(url);
}

function isMacDmgDownloadUrl(url: string | null | undefined): url is string {
  if (!isValidDownloadUrl(url)) return false;
  return /\.dmg(\?|$)/i.test(url);
}

/** 优先 zip：支持相对路径或外部绝对 URL */
function pickMacHref(manifest: DownloadManifest | null): string | null {
  const zip = manifest?.macZipUrl;
  if (isMacZipDownloadUrl(zip)) return zip;
  const dmg = manifest?.macDmgUrl;
  if (isMacDmgDownloadUrl(dmg)) return dmg;
  return null;
}

function pickMacDmgHref(manifest: DownloadManifest | null): string | null {
  const dmg = manifest?.macDmgUrl;
  return isValidDownloadUrl(dmg) ? dmg : null;
}

function pickWinHref(manifest: DownloadManifest | null): string | null {
  const setup = manifest?.winSetupUrl;
  const zip = manifest?.winZipUrl;
  if (isValidDownloadUrl(setup)) return setup;
  if (isValidDownloadUrl(zip)) return zip;
  return null;
}

export function LocalAgentDownloadCard({
  projectId,
  platformAccounts: platformAccountsProp = [],
  boundPublishAccountCount: boundPublishAccountCountProp = 0,
  localAgentAccountSnapshot = [],
}: Props) {
  const [localHttpOk, setLocalHttpOk] = useState<boolean | null>(null);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof checkLocalAgentHealth>>>(null);
  const [checking, setChecking] = useState(false);
  const [refreshingAccounts, setRefreshingAccounts] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [manifest, setManifest] = useState<DownloadManifest | null>(null);
  const [macHref, setMacHref] = useState<string | null>(null);
  const [localSnapshot, setLocalSnapshot] = useState<LocalAgentAccountStatusEntry[]>(
    localAgentAccountSnapshot,
  );

  const syncSnapshot = trpc.geo.platformAccounts.syncLocalAgentSnapshot.useMutation();
  const utils = trpc.useUtils();

  const accountsQuery = trpc.geo.platformAccounts.list.useQuery(
    { projectId: projectId! },
    { enabled: Boolean(projectId) },
  );

  const serverContextFromQuery = useMemo(
    () => buildLocalAgentDownloadCardServerContext(accountsQuery.data?.accounts ?? []),
    [accountsQuery.data?.accounts],
  );

  const platformAccounts = useMemo(() => {
    if (serverContextFromQuery.platformAccounts.length > 0) {
      return serverContextFromQuery.platformAccounts;
    }
    return platformAccountsProp;
  }, [platformAccountsProp, serverContextFromQuery.platformAccounts]);

  const boundPublishAccountCount = useMemo(() => {
    if (serverContextFromQuery.boundPublishAccountCount > 0) {
      return serverContextFromQuery.boundPublishAccountCount;
    }
    return boundPublishAccountCountProp;
  }, [boundPublishAccountCountProp, serverContextFromQuery.boundPublishAccountCount]);

  const effectiveSnapshot = useMemo(() => {
    if (localSnapshot.length > 0) return localSnapshot;
    return localAgentAccountSnapshot;
  }, [localAgentAccountSnapshot, localSnapshot]);

  const serverHeartbeat = useMemo(
    () => inferServerHeartbeatFromPlatformAccounts(platformAccounts),
    [platformAccounts],
  );

  const resolvedState = useMemo(
    (): LocalAgentResolvedConnectionState =>
      resolveLocalAgentConnectionState({
        serverHeartbeatConnected: serverHeartbeat.connected,
        serverLastActivityAt: serverHeartbeat.lastActivityAt,
        platformAccounts,
        localHttpCheckResult: localHttpOk,
        localAgentAccountSnapshot: effectiveSnapshot,
        boundPublishAccountCount,
      }),
    [
      boundPublishAccountCount,
      effectiveSnapshot,
      localHttpOk,
      platformAccounts,
      serverHeartbeat.connected,
      serverHeartbeat.lastActivityAt,
    ],
  );

  const probeStatus = useMemo((): LocalAgentConnectionStatus | undefined => {
    if (localHttpOk == null) return undefined;
    return resolveConnectionStatusAfterHealthProbe({
      ok: localHttpOk,
      accountSnapshotCount: effectiveSnapshot.length,
      boundPublishAccountCount,
    });
  }, [boundPublishAccountCount, effectiveSnapshot.length, localHttpOk]);

  const uiConnectionStatus = useMemo(
    () =>
      deriveLocalAgentUiConnectionStatus({
        resolvedState,
        boundPublishAccountCount,
        localAgentAccountSnapshot: effectiveSnapshot,
        localHttpCheckResult: localHttpOk,
        probeStatus,
      }),
    [boundPublishAccountCount, effectiveSnapshot, localHttpOk, probeStatus, resolvedState],
  );

  const connectedOnline = isLocalAgentResolvedConnected(resolvedState);
  const accountNotSynced = uiConnectionStatus === "CONNECTED_ACCOUNT_NOT_SYNCED";

  const refreshHealth = useCallback(async (force = false) => {
    setChecking(true);
    try {
      const h = await checkLocalAgentHealth(force ? { force: true } : undefined);
      setHealth(h);
      const ok = Boolean(h?.ok);
      setLocalHttpOk(ok);
      if (ok) {
        const snapshot = await listLocalAgentAccountSnapshots();
        setLocalSnapshot(snapshot);
      } else {
        setLocalSnapshot([]);
      }
      return h;
    } finally {
      setHasChecked(true);
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  const resolveServerContextForDetect = useCallback(async () => {
    if (!projectId) {
      return {
        platformAccounts,
        boundPublishAccountCount,
      };
    }
    const fresh = await accountsQuery.refetch();
    return buildLocalAgentDownloadCardServerContext(fresh.data?.accounts ?? []);
  }, [accountsQuery, boundPublishAccountCount, platformAccounts, projectId]);

  useEffect(() => {
    fetch("/downloads/manifest.json")
      .then(r => (r.ok ? r.json() : null))
      .then((m: DownloadManifest | null) => {
        setManifest(m);
        setMacHref(pickMacHref(m));
      })
      .catch(() => {
        setManifest(null);
        setMacHref(null);
      });
  }, []);

  const winHref = pickWinHref(manifest);
  const winOffered = Boolean(winHref);

  const handleDetect = async () => {
    const serverContext = await resolveServerContextForDetect();
    const heartbeat = inferServerHeartbeatFromPlatformAccounts(serverContext.platformAccounts);
    const h = await refreshHealth(true);
    const snapshot = h?.ok ? await listLocalAgentAccountSnapshots() : [];
    if (snapshot.length > 0) setLocalSnapshot(snapshot);
    const nextState = resolveLocalAgentConnectionState({
      serverHeartbeatConnected: heartbeat.connected,
      serverLastActivityAt: heartbeat.lastActivityAt,
      platformAccounts: serverContext.platformAccounts,
      localHttpCheckResult: Boolean(h?.ok),
      localAgentAccountSnapshot: snapshot.length > 0 ? snapshot : effectiveSnapshot,
      boundPublishAccountCount: serverContext.boundPublishAccountCount,
    });
    const nextProbeStatus = resolveConnectionStatusAfterHealthProbe({
      ok: Boolean(h?.ok),
      accountSnapshotCount: snapshot.length,
      boundPublishAccountCount: serverContext.boundPublishAccountCount,
    });
    const nextUiStatus = deriveLocalAgentUiConnectionStatus({
      resolvedState: nextState,
      boundPublishAccountCount: serverContext.boundPublishAccountCount,
      localAgentAccountSnapshot: snapshot.length > 0 ? snapshot : effectiveSnapshot,
      localHttpCheckResult: Boolean(h?.ok),
      probeStatus: nextProbeStatus,
    });
    if (nextUiStatus === "CONNECTED_ACCOUNT_NOT_SYNCED") {
      toast.message(LOCAL_AGENT_PROJECT_ACCOUNT_NOT_SYNCED_DETAIL);
      return;
    }
    const feedback = localAgentConnectionCheckFeedback(nextState, {
      localHttpCheckResult: Boolean(h?.ok),
    });
    if (feedback.kind === "success") toast.success(feedback.message);
    else if (feedback.kind === "info") toast.message(feedback.message);
    else toast.error(feedback.message);
  };

  const handleRefreshAccountStatus = async () => {
    if (!projectId) {
      toast.error("请先选择项目后再刷新账号状态");
      return;
    }
    setRefreshingAccounts(true);
    try {
      const h = await refreshHealth(true);
      if (!h?.ok) {
        toast.error("未检测到本地发布助手，请打开客户端后重试");
        return;
      }
      const serverContext = await resolveServerContextForDetect();
      const snapshots = await listLocalAgentAccountSnapshots();
      setLocalSnapshot(snapshots);
      const profileIds = serverContext.platformAccounts
        .map(row => row.localProfileId?.trim())
        .filter((id): id is string => Boolean(id));
      const entries = selectSnapshotEntriesForProjectSync(snapshots, profileIds);
      if (entries.length === 0) {
        toast.message("本地客户端暂无有效发布账号，请先在客户端登录账号");
        return;
      }
      await syncSnapshot.mutateAsync({
        agentId: h.agentId,
        projectId,
        accounts: entries,
      });
      await utils.geo.platformAccounts.list.invalidate({ projectId });
      toast.success("账号状态已同步到当前项目");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "刷新账号状态失败");
    } finally {
      setRefreshingAccounts(false);
    }
  };

  const connectionDetail = localAgentDownloadCardConnectionDetail({
    state: resolvedState,
    healthVersion: health?.version,
    hasCheckedLocalHttp: hasChecked,
    uiConnectionStatus,
  });
  const uiCopy = localAgentConnectionCopy(uiConnectionStatus);

  const debugEnabled = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("debugLocalAgent") === "1";
  }, []);

  const debugInfo = useMemo(
    () =>
      buildLocalAgentConnectionDebugInfo({
        projectId: projectId ?? null,
        platformAccounts,
        localAgentAccountSnapshot: effectiveSnapshot,
        boundPublishAccountCount,
        localHttpCheckResult: localHttpOk,
        resolvedState,
        uiConnectionStatus,
      }),
    [
      boundPublishAccountCount,
      effectiveSnapshot,
      localHttpOk,
      platformAccounts,
      projectId,
      resolvedState,
      uiConnectionStatus,
    ],
  );

  const macOffered = Boolean(macHref);
  const macIsZip = Boolean(macHref && /\.zip(\?|$)/i.test(macHref));
  const macDmgHref = pickMacDmgHref(manifest);
  const macLabel = macIsZip ? "下载 Mac 客户端（推荐）" : "下载 Mac 客户端";

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      id="local-agent-download"
      data-testid="local-agent-download-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">下载 GEO 本地发布客户端</h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-600">
            用于托管本机发布账号环境，自动接收 GEO Web 下发的发布任务。不保存平台密码，不上传 Cookie。
          </p>
        </div>
        {connectedOnline ? (
          accountNotSynced ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700" data-testid="local-agent-account-not-synced">
              <AlertCircle className="size-3.5" />
              在线 · 待同步
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700" data-testid="local-agent-connected">
              <CheckCircle2 className="size-3.5" />
              已连接
            </span>
          )
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700" data-testid="local-agent-offline">
            <AlertCircle className="size-3.5" />
            未连接
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-gray-600">
        {connectedOnline || accountNotSynced ? (
          <span data-testid="local-agent-health-detail">{connectionDetail}</span>
        ) : (
          <span data-testid="local-agent-health-offline">{connectionDetail}</span>
        )}
      </p>

      {accountNotSynced ? (
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="refresh-local-agent-account-status"
            disabled={refreshingAccounts || checking}
            onClick={() => void handleRefreshAccountStatus()}
          >
            {refreshingAccounts ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 size-3.5" />}
            {uiCopy.primaryButton ?? "刷新账号状态"}
          </Button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {macOffered && macHref ? (
          <Button type="button" size="sm" className="bg-blue-600 text-white hover:bg-blue-700" asChild data-testid="download-mac-agent">
            <a href={macHref} download>
              <Download className="mr-1.5 size-3.5" />
              {macLabel}
            </a>
          </Button>
        ) : (
          <Button type="button" size="sm" disabled data-testid="download-mac-agent">
            <Download className="mr-1.5 size-3.5" />
            安装包暂未配置
          </Button>
        )}
        {winOffered && winHref ? (
          <Button type="button" size="sm" variant="outline" asChild data-testid="download-win">
            <a href={winHref} download>
              下载 Windows 客户端
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled
            className="border-gray-200 text-gray-400"
            data-testid="download-win-soon"
          >
            Windows 客户端即将支持
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="detect-local-agent"
          disabled={checking}
          onClick={() => void handleDetect()}
        >
          {checking ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 size-3.5" />}
          检测客户端
        </Button>
      </div>

      <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 text-sm" data-testid="mac-install-gatekeeper-hint">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium text-amber-800 [&::-webkit-details-marker]:hidden">
          <ChevronDown className="size-4 transition-transform [[open]>&]:rotate-180" />
          Mac 首次打开帮助
        </summary>
        <div className="border-t border-amber-200 px-4 pb-4 pt-3 text-amber-900">
          <p className="font-medium">如果系统提示「已损坏，无法打开」</p>
          <p className="mt-2 text-amber-800">
            这是 macOS 对<strong className="font-semibold">未签名</strong>安装包的常见安全限制，不代表安装包损坏。请按以下方式处理：
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-amber-800">
            <li>
              解压 zip 后，将「GEO本地发布客户端」拖入「应用程序」文件夹。
            </li>
            <li>
              在「应用程序」中找到该 App，<strong>按住 Control 键点击 → 打开</strong>，在弹窗中选择「打开」。
            </li>
            <li>
              如仍无法打开，打开终端执行：
              <code className="mt-1 block rounded border border-amber-300 bg-white px-2 py-1 text-xs text-gray-800">
                xattr -cr &quot;/Applications/GEO本地发布客户端.app&quot;
              </code>
            </li>
          </ol>
          {macDmgHref && macIsZip ? (
            <p className="mt-3 text-xs text-amber-700">
              若需要 dmg 安装包：
              <a href={macDmgHref} className="ml-1 font-medium underline" download>
                下载 Mac dmg 备用
              </a>
            </p>
          ) : null}
        </div>
      </details>

      {health ? (
        <details className="mt-3 text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-700 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1">
              <ChevronDown className="size-3 transition-transform [[open]>&]:rotate-180" />
              技术信息
            </span>
          </summary>
          <div className="mt-1 rounded border border-gray-100 bg-gray-50 px-3 py-2 font-mono text-[11px] text-gray-500">
            客户端 ID：{health.agentId} · 版本：v{health.version}
          </div>
        </details>
      ) : null}

      {debugEnabled ? (
        <details className="mt-3 rounded-lg border border-violet-200 bg-violet-50 text-xs" data-testid="local-agent-debug-panel" open>
          <summary className="cursor-pointer px-4 py-3 font-medium text-violet-900">Local Agent Debug</summary>
          <dl className="grid gap-1 border-t border-violet-200 px-4 py-3 font-mono text-[11px] text-violet-950">
            <div>projectId: {String(debugInfo.projectId)}</div>
            <div>platformAccountsCount: {debugInfo.platformAccountsCount}</div>
            <div>accountSnapshotCount: {debugInfo.accountSnapshotCount}</div>
            <div>boundPublishAccountCount: {debugInfo.boundPublishAccountCount}</div>
            <div>resolvedState: {debugInfo.resolvedState}</div>
            <div>uiConnectionStatus: {debugInfo.uiConnectionStatus}</div>
            <div>hasServerHeartbeat: {String(debugInfo.hasServerHeartbeat)}</div>
            <div>hasValidAccountSnapshot: {String(debugInfo.hasValidAccountSnapshot)}</div>
            <div>localHttpCheckStatus: {String(debugInfo.localHttpCheckStatus)}</div>
            <div>reason: {debugInfo.reason}</div>
            <div>accountsQueryStatus: {accountsQuery.status}</div>
            <div>propsPlatformAccountsCount: {platformAccountsProp.length}</div>
          </dl>
        </details>
      ) : null}
    </div>
  );
}
