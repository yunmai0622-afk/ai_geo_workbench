import fs from "fs";
import path from "path";
import { DATA_DIR } from "./storage";
import { getAgentId } from "./agentMeta";

export type AgentTaskConfig = {
  serverUrl: string;
  agentApiKey: string;
  localAgentId: string;
  /** @deprecated 使用 autoStartPolling */
  autoPoll?: boolean;
  /** @deprecated 使用 pollIntervalSeconds */
  pollIntervalMs?: number;
  pollIntervalSeconds: number;
  autoStartPolling: boolean;
  logRetentionDays: number;
  maxTasksPerCycle: number;
  launchAtLogin: boolean;
};

const CONFIG_PATH = path.join(DATA_DIR, "config.json");

export const DEFAULT_MAX_TASKS_PER_CYCLE = 1;

const DEFAULTS: AgentTaskConfig = {
  serverUrl: "http://127.0.0.1:3000",
  agentApiKey: "",
  localAgentId: "",
  pollIntervalSeconds: 15,
  autoStartPolling: false,
  logRetentionDays: 14,
  maxTasksPerCycle: DEFAULT_MAX_TASKS_PER_CYCLE,
  launchAtLogin: false,
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeConfig(parsed: Partial<AgentTaskConfig>): AgentTaskConfig {
  const pollIntervalSeconds = Math.max(
    5,
    parsed.pollIntervalSeconds ??
      (parsed.pollIntervalMs ? Math.round(parsed.pollIntervalMs / 1000) : DEFAULTS.pollIntervalSeconds),
  );
  return {
    serverUrl: (parsed.serverUrl ?? DEFAULTS.serverUrl).replace(/\/$/, ""),
    agentApiKey: parsed.agentApiKey ?? "",
    localAgentId: parsed.localAgentId?.trim() || getAgentId(),
    pollIntervalSeconds,
    autoStartPolling: Boolean(parsed.autoStartPolling ?? parsed.autoPoll ?? DEFAULTS.autoStartPolling),
    logRetentionDays: Math.max(1, parsed.logRetentionDays ?? DEFAULTS.logRetentionDays),
    maxTasksPerCycle: Math.max(1, Math.min(3, parsed.maxTasksPerCycle ?? DEFAULTS.maxTasksPerCycle)),
    launchAtLogin: Boolean(parsed.launchAtLogin),
  };
}

export function readAgentConfig(): AgentTaskConfig {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    const initial = normalizeConfig(DEFAULTS);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(toPersisted(initial), null, 2), "utf-8");
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as Partial<AgentTaskConfig>;
    return normalizeConfig(parsed);
  } catch {
    return normalizeConfig(DEFAULTS);
  }
}

function toPersisted(cfg: AgentTaskConfig) {
  return {
    serverUrl: cfg.serverUrl,
    agentApiKey: cfg.agentApiKey,
    localAgentId: cfg.localAgentId,
    pollIntervalSeconds: cfg.pollIntervalSeconds,
    autoStartPolling: cfg.autoStartPolling,
    logRetentionDays: cfg.logRetentionDays,
    maxTasksPerCycle: cfg.maxTasksPerCycle,
    launchAtLogin: cfg.launchAtLogin,
  };
}

export function writeAgentConfig(patch: Partial<AgentTaskConfig>): AgentTaskConfig {
  const current = readAgentConfig();
  const next = normalizeConfig({ ...current, ...patch });
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(toPersisted(next), null, 2), "utf-8");
  return next;
}

export function getPollIntervalMs(): number {
  return readAgentConfig().pollIntervalSeconds * 1000;
}
