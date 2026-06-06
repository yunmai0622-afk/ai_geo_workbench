import type { LocalAgentAccountStatusEntry } from "./localAgentAccountSync";
import { isLocalAgentAccountEntryValid } from "./localAgentAccountSync";

/** Web 侧 Local Agent 连接状态（与 local-agent 进程无关，仅描述浏览器探测结果） */

export const LOCAL_AGENT_CONNECTION_STATUSES = [
  "UNKNOWN",
  "CHECKING",
  "CONNECTED",
  "CONNECTED_ACCOUNT_NOT_SYNCED",
  "DISCONNECTED",
  "ERROR",
] as const;

export type LocalAgentConnectionStatus = (typeof LOCAL_AGENT_CONNECTION_STATUSES)[number];

export const LOCAL_AGENT_CONNECTION_CACHE_KEY = "geo.localAgent.connectionStatus.v1";

export const LOCAL_AGENT_TROUBLESHOOTING_ANCHOR = "#local-agent-download";

export type LocalAgentConnectionCopy = {
  title: string;
  description: string;
  primaryButton: string | null;
  secondaryButton: string | null;
};

export const LOCAL_AGENT_CONNECTION_COPY: Record<LocalAgentConnectionStatus, LocalAgentConnectionCopy> = {
  UNKNOWN: {
    title: "尚未检测本地客户端连接状态",
    description: "发布任务需要通过本地 GEO 发布客户端执行。请先检测连接状态。",
    primaryButton: "检测本地客户端连接",
    secondaryButton: null,
  },
  CHECKING: {
    title: "正在检测本地客户端连接",
    description: "正在尝试连接本机 GEO 发布客户端，请稍候。",
    primaryButton: null,
    secondaryButton: null,
  },
  CONNECTED: {
    title: "本地客户端已连接",
    description: "可以接收发布任务。",
    primaryButton: "刷新账号状态",
    secondaryButton: null,
  },
  CONNECTED_ACCOUNT_NOT_SYNCED: {
    title: "客户端已连接，账号状态待同步",
    description: "请刷新账号状态，系统会读取本地客户端中已登录的平台账号。",
    primaryButton: "刷新账号状态",
    secondaryButton: null,
  },
  DISCONNECTED: {
    title: "未检测到本地客户端",
    description:
      "请确认 GEO 本地发布客户端已打开。如果已打开仍未连接，请检查客户端是否显示「本地 HTTP 已启动」。",
    primaryButton: "检测连接",
    secondaryButton: "下载/打开本地客户端",
  },
  ERROR: {
    title: "本地客户端连接检测失败",
    description:
      "可能原因：1. 客户端未打开；2. 本地 HTTP 服务未启动；3. 浏览器无法访问本机端口；4. 客户端版本过旧。",
    primaryButton: "重新检测",
    secondaryButton: "查看排查说明",
  },
};

export const LEGACY_LOCAL_AGENT_DISCONNECTED_MESSAGE =
  "请先打开 GEO 本地发布客户端，并刷新连接状态。";

export function localAgentConnectionCopy(status: LocalAgentConnectionStatus): LocalAgentConnectionCopy {
  return LOCAL_AGENT_CONNECTION_COPY[status];
}

export function isLocalAgentConnectionStatus(value: string): value is LocalAgentConnectionStatus {
  return (LOCAL_AGENT_CONNECTION_STATUSES as readonly string[]).includes(value);
}

export function readCachedLocalAgentConnectionStatus(): LocalAgentConnectionStatus | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LOCAL_AGENT_CONNECTION_CACHE_KEY);
    if (!raw || !isLocalAgentConnectionStatus(raw)) return null;
    if (raw === "CHECKING") return null;
    return raw;
  } catch {
    return null;
  }
}

export function writeCachedLocalAgentConnectionStatus(status: LocalAgentConnectionStatus): void {
  if (typeof sessionStorage === "undefined") return;
  if (status === "CHECKING") return;
  try {
    sessionStorage.setItem(LOCAL_AGENT_CONNECTION_CACHE_KEY, status);
  } catch {
    // ignore
  }
}

export function mapBooleanOnlineToConnectionStatus(
  online: boolean | null | undefined,
): LocalAgentConnectionStatus {
  if (online === true) return "CONNECTED";
  if (online === false) return "DISCONNECTED";
  return readCachedLocalAgentConnectionStatus() ?? "UNKNOWN";
}

export type LocalAgentRiskHintContext = {
  boundPublishAccountCount?: number;
  localAccountSnapshotEmpty?: boolean;
};

export function localAgentConnectionRiskHint(
  status: LocalAgentConnectionStatus,
  context: LocalAgentRiskHintContext = {},
): string | null {
  switch (status) {
    case "UNKNOWN":
      return "尚未检测本地客户端连接状态，请点击检测连接。";
    case "CHECKING":
      return null;
    case "DISCONNECTED":
      return "未检测到本地客户端。请确认客户端已打开，并点击检测连接。";
    case "ERROR":
      return "本地客户端连接检测失败，请重新检测或查看排查说明。";
    case "CONNECTED_ACCOUNT_NOT_SYNCED":
      return "客户端已连接，但账号状态尚未同步到本页。请点击刷新账号状态。";
    case "CONNECTED":
      if (context.boundPublishAccountCount === 0 || context.localAccountSnapshotEmpty) {
        return "尚未在本地发布客户端配置可发布账号。请在客户端「账号环境」中创建并登录。";
      }
      return null;
    default:
      return null;
  }
}

export function resolveConnectionStatusAfterHealthProbe(input: {
  ok: boolean;
  accountSnapshotCount: number;
  boundPublishAccountCount: number;
  probeThrew?: boolean;
}): LocalAgentConnectionStatus {
  if (input.probeThrew) return "ERROR";
  if (!input.ok) return "DISCONNECTED";
  if (input.boundPublishAccountCount > 0 && input.accountSnapshotCount === 0) {
    return "CONNECTED_ACCOUNT_NOT_SYNCED";
  }
  return "CONNECTED";
}

/** 服务端心跳有效时间窗口（5 分钟） */
export const LOCAL_AGENT_SERVER_HEARTBEAT_WINDOW_MS = 5 * 60 * 1000;

export const LOCAL_AGENT_RESOLVED_CONNECTION_STATES = [
  "CONNECTED_CONFIRMED",
  "CONNECTED_BY_SERVER_HEARTBEAT",
  "CONNECTED_BY_LOCAL_HTTP",
  "UNKNOWN_NEEDS_CHECK",
  "DISCONNECTED",
  "CHECK_FAILED",
] as const;

export type LocalAgentResolvedConnectionState =
  (typeof LOCAL_AGENT_RESOLVED_CONNECTION_STATES)[number];

export type ServerHeartbeatPlatformAccountRow = {
  localAgentId?: string | null;
  localProfileId?: string | null;
  sessionStatus?: string | null;
  lastSessionCheckedAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

export type ResolveLocalAgentConnectionStateInput = {
  serverHeartbeatConnected?: boolean | null;
  serverLastActivityAt?: string | Date | null;
  platformAccounts?: ServerHeartbeatPlatformAccountRow[];
  localHttpCheckResult?: boolean | null;
  localHttpProbeThrew?: boolean;
  localAgentAccountSnapshot?: LocalAgentAccountStatusEntry[];
  boundPublishAccountCount?: number;
};

export type ServerHeartbeatInference = {
  connected: boolean;
  lastActivityAt: string | null;
};

function parseActivityTimestamp(value: string | Date | null | undefined): number | null {
  if (value == null) return null;
  const at = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(at) ? at : null;
}

function isRecentActivityTimestamp(value: string | Date | null | undefined, now = Date.now()): boolean {
  const at = parseActivityTimestamp(value);
  if (at == null) return true;
  return now - at <= LOCAL_AGENT_SERVER_HEARTBEAT_WINDOW_MS;
}

export function rowIndicatesServerHeartbeat(row: ServerHeartbeatPlatformAccountRow): boolean {
  return (
    Boolean(row.localAgentId?.trim()) &&
    Boolean(row.localProfileId?.trim()) &&
    row.sessionStatus === "active"
  );
}

export function hasActiveServerSessionRows(
  accounts: ServerHeartbeatPlatformAccountRow[] | undefined,
): boolean {
  return (accounts ?? []).some(rowIndicatesServerHeartbeat);
}

/** 从 DB 平台账号推断服务端是否近期感知到 Local Agent 在线 */
export function inferServerHeartbeatFromPlatformAccounts(
  accounts: ServerHeartbeatPlatformAccountRow[] | undefined,
  now = Date.now(),
): ServerHeartbeatInference {
  let lastActivityAt: number | null = null;
  let connected = false;
  for (const row of accounts ?? []) {
    if (!rowIndicatesServerHeartbeat(row)) continue;
    const candidates = [row.lastSessionCheckedAt, row.updatedAt].map(parseActivityTimestamp);
    const rowActivity = candidates.find(v => v != null) ?? null;
    if (rowActivity != null) {
      lastActivityAt = lastActivityAt == null ? rowActivity : Math.max(lastActivityAt, rowActivity);
    }
    if (isRecentActivityTimestamp(row.lastSessionCheckedAt ?? row.updatedAt, now)) {
      connected = true;
    }
  }
  return {
    connected,
    lastActivityAt: lastActivityAt != null ? new Date(lastActivityAt).toISOString() : null,
  };
}

function snapshotIndicatesRecentServerSync(
  snapshot: LocalAgentAccountStatusEntry[] | undefined,
  now = Date.now(),
): boolean {
  return (snapshot ?? []).some(
    entry => isLocalAgentAccountEntryValid(entry) && isRecentActivityTimestamp(entry.lastCheckedAt, now),
  );
}

/** 统一 Local Agent 连接状态（Web / 发布前检查 / 工作台共用） */
export function resolveLocalAgentConnectionState(
  input: ResolveLocalAgentConnectionStateInput,
  now = Date.now(),
): LocalAgentResolvedConnectionState {
  const heartbeat =
    input.serverHeartbeatConnected != null
      ? {
          connected: Boolean(input.serverHeartbeatConnected),
          lastActivityAt:
            input.serverLastActivityAt != null
              ? new Date(input.serverLastActivityAt).toISOString()
              : null,
        }
      : inferServerHeartbeatFromPlatformAccounts(input.platformAccounts, now);

  const serverRecent =
    heartbeat.connected &&
    (heartbeat.lastActivityAt == null || isRecentActivityTimestamp(heartbeat.lastActivityAt, now));

  const snapshotRecent = snapshotIndicatesRecentServerSync(input.localAgentAccountSnapshot, now);
  const activeServerSession = hasActiveServerSessionRows(input.platformAccounts);

  const serverOnline =
    serverRecent || snapshotRecent || activeServerSession || heartbeat.connected;

  const localOk = input.localHttpCheckResult === true;
  const localFailed = input.localHttpCheckResult === false || input.localHttpProbeThrew === true;

  if (serverOnline && localOk) return "CONNECTED_CONFIRMED";
  if (serverOnline) return "CONNECTED_BY_SERVER_HEARTBEAT";
  if (localOk) return "CONNECTED_BY_LOCAL_HTTP";
  if (localFailed) return input.localHttpProbeThrew ? "CHECK_FAILED" : "DISCONNECTED";
  if (input.localHttpCheckResult == null) return "UNKNOWN_NEEDS_CHECK";
  return "DISCONNECTED";
}

export function isLocalAgentResolvedConnected(state: LocalAgentResolvedConnectionState): boolean {
  return (
    state === "CONNECTED_CONFIRMED" ||
    state === "CONNECTED_BY_SERVER_HEARTBEAT" ||
    state === "CONNECTED_BY_LOCAL_HTTP"
  );
}

export function mapResolvedStateToConnectionStatus(
  state: LocalAgentResolvedConnectionState,
  localProbeStatus?: LocalAgentConnectionStatus,
): LocalAgentConnectionStatus {
  if (localProbeStatus === "CHECKING") return "CHECKING";
  if (localProbeStatus === "CONNECTED_ACCOUNT_NOT_SYNCED" && isLocalAgentResolvedConnected(state)) {
    return "CONNECTED_ACCOUNT_NOT_SYNCED";
  }
  switch (state) {
    case "CONNECTED_CONFIRMED":
    case "CONNECTED_BY_SERVER_HEARTBEAT":
    case "CONNECTED_BY_LOCAL_HTTP":
      return localProbeStatus === "CONNECTED_ACCOUNT_NOT_SYNCED"
        ? "CONNECTED_ACCOUNT_NOT_SYNCED"
        : "CONNECTED";
    case "CHECK_FAILED":
      return "ERROR";
    case "DISCONNECTED":
      return "DISCONNECTED";
    case "UNKNOWN_NEEDS_CHECK":
    default:
      return "UNKNOWN";
  }
}

export function resolvePublishStatusLocalAgentLabelFromResolved(
  state: LocalAgentResolvedConnectionState,
): string {
  if (isLocalAgentResolvedConnected(state)) {
    if (state === "CONNECTED_BY_SERVER_HEARTBEAT") return "已连接（服务端）";
    return "已连接";
  }
  if (state === "CHECK_FAILED" || state === "DISCONNECTED") return "未连接";
  return "未检测";
}

export type LocalAgentConnectionCheckFeedback = {
  kind: "success" | "info" | "error";
  message: string;
};

export const LOCAL_AGENT_SERVER_ONLINE_LOCAL_HTTP_FAILED_MESSAGE =
  "已检测到本地发布助手在线；本地直接检测未通过，但不影响任务下发。若任务未出现，请在客户端点击「立即拉取任务」。";

export const LOCAL_AGENT_SERVER_ONLINE_READY_MESSAGE =
  "已检测到本地发布助手在线，可继续发布。";

/** 「检测客户端」按钮反馈文案 */
export function localAgentConnectionCheckFeedback(
  state: LocalAgentResolvedConnectionState,
  options?: { localHttpCheckResult?: boolean | null },
): LocalAgentConnectionCheckFeedback {
  if (state === "CONNECTED_CONFIRMED" || state === "CONNECTED_BY_LOCAL_HTTP") {
    return { kind: "success", message: "本地发布助手已连接" };
  }
  if (state === "CONNECTED_BY_SERVER_HEARTBEAT") {
    const localFailed = options?.localHttpCheckResult === false;
    return {
      kind: "info",
      message: localFailed
        ? LOCAL_AGENT_SERVER_ONLINE_LOCAL_HTTP_FAILED_MESSAGE
        : `${LOCAL_AGENT_SERVER_ONLINE_READY_MESSAGE}若无法自动拉取任务，请在客户端点击「立即拉取任务」。`,
    };
  }
  if (state === "UNKNOWN_NEEDS_CHECK") {
    return { kind: "info", message: "尚未检测本地客户端连接状态，请确认客户端已打开后重试" };
  }
  return {
    kind: "error",
    message: "未检测到本地发布助手，请打开客户端后重试。",
  };
}

export function localAgentResolvedConnectionRiskHint(
  state: LocalAgentResolvedConnectionState,
  context: LocalAgentRiskHintContext = {},
): string | null {
  if (state === "CONNECTED_BY_SERVER_HEARTBEAT") {
    return "本地发布助手已通过服务端确认在线。若任务未自动出现，请在客户端点击「立即拉取任务」。";
  }
  return localAgentConnectionRiskHint(mapResolvedStateToConnectionStatus(state), context);
}

/** 下载卡片 / 帮助区主提示文案 */
export function localAgentDownloadCardConnectionDetail(input: {
  state: LocalAgentResolvedConnectionState;
  healthVersion?: string | null;
  hasCheckedLocalHttp?: boolean;
}): string {
  if (!isLocalAgentResolvedConnected(input.state)) {
    return input.hasCheckedLocalHttp
      ? "未检测到本地发布助手，请打开客户端后重试。"
      : "尚未检测本地客户端连接状态，可点击「检测客户端」确认。";
  }
  if (input.healthVersion?.trim()) {
    return `客户端已连接 · v${input.healthVersion.trim()}`;
  }
  if (input.state === "CONNECTED_BY_SERVER_HEARTBEAT") {
    return LOCAL_AGENT_SERVER_ONLINE_READY_MESSAGE;
  }
  return "客户端已连接";
}
