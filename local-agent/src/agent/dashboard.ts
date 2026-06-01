import os from "os";
import { readAgentConfig } from "./agentConfig";
import { AGENT_VERSION, loadOrCreateAgentMeta } from "./agentMeta";
import { LOCAL_AGENT_HOST, LOCAL_AGENT_PORT } from "./localServer";
import { getLocalHttpStartupError } from "./localHttpState";
import { getPollingState } from "./pollingManager";
import { listRecentTaskLogs } from "./taskLogStore";
import { DATA_DIR, readAccounts } from "./storage";
import { formatGeoServerConnectionError } from "./localAgentServerUrl";
import { listAgentTasks, testServerConnection } from "./taskClient";

const LOCAL_HTTP_BASE = `http://${LOCAL_AGENT_HOST}:${LOCAL_AGENT_PORT}`;

async function probeLocalHttp(): Promise<{
  ok: boolean;
  url: string;
  error: string | null;
  agentId: string | null;
  startedAt: string | null;
  version: string | null;
}> {
  try {
    const res = await fetch(`${LOCAL_HTTP_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) {
      return {
        ok: false,
        url: LOCAL_HTTP_BASE,
        error: `HTTP ${res.status}`,
        agentId: null,
        startedAt: null,
        version: null,
      };
    }
    const data = (await res.json()) as {
      agentId?: string;
      startedAt?: string;
      version?: string;
    };
    return {
      ok: true,
      url: LOCAL_HTTP_BASE,
      error: null,
      agentId: data.agentId ?? null,
      startedAt: data.startedAt ?? null,
      version: data.version ?? null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      url: LOCAL_HTTP_BASE,
      error: msg,
      agentId: null,
      startedAt: null,
      version: null,
    };
  }
}

export async function buildDashboard() {
  const cfg = readAgentConfig();
  const accounts = readAccounts().accounts;
  const activeCount = accounts.filter(a => a.sessionStatus === "active").length;
  const polling = getPollingState();
  const meta = loadOrCreateAgentMeta();

  let serverTasks: Awaited<ReturnType<typeof listAgentTasks>> | null = null;
  let serverError: string | null = null;
  try {
    serverTasks = await listAgentTasks(cfg.localAgentId, 50);
  } catch (e) {
    serverError = formatGeoServerConnectionError(e, cfg.serverUrl).userMessage;
  }

  const pendingCount =
    serverTasks?.tasks.filter(t => t.status === "pending_agent").length ?? 0;
  const today = new Date().toDateString();
  const todayCount =
    serverTasks?.tasks.filter(t => new Date(t.createdAt).toDateString() === today).length ?? 0;

  const recentFailed =
    serverTasks?.tasks.find(t => t.status === "failed" || t.status === "session_expired") ??
    null;

  const localLogs = listRecentTaskLogs(20);
  const localHttp = await probeLocalHttp();

  const localHttpStartupError = getLocalHttpStartupError();

  return {
    appVersion: AGENT_VERSION,
    localHttp: {
      ...localHttp,
      startupError: localHttpStartupError,
    },
    deviceName: meta.deviceName,
    dataDir: DATA_DIR,
    config: {
      serverUrl: cfg.serverUrl,
      localAgentId: cfg.localAgentId,
      pollIntervalSeconds: cfg.pollIntervalSeconds,
      autoStartPolling: cfg.autoStartPolling,
      logRetentionDays: cfg.logRetentionDays,
      maxTasksPerCycle: cfg.maxTasksPerCycle,
      launchAtLogin: cfg.launchAtLogin,
      hasApiKey: Boolean(cfg.agentApiKey?.trim()),
    },
    polling,
    serverConnected: serverTasks !== null,
    serverError: serverError ?? polling.lastConnectionError,
    accountTotal: accounts.length,
    accountActive: activeCount,
    pendingTaskCount: pendingCount,
    todayTaskCount: todayCount,
    recentFailure: recentFailed
      ? {
          taskId: recentFailed.id,
          platform: recentFailed.platform,
          status: recentFailed.status,
          message: recentFailed.agentErrorMessage ?? recentFailed.errorMessage ?? null,
          createdAt: recentFailed.createdAt,
          agentFinishedAt: recentFailed.agentFinishedAt,
        }
      : null,
    accounts,
    serverTasks: serverTasks?.tasks ?? [],
    localTaskLogs: localLogs,
    platformInfo: {
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
    },
  };
}

export async function testConnection() {
  return testServerConnection();
}
