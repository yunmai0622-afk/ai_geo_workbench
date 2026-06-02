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
