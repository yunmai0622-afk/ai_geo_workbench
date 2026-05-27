import fs from "fs";
import path from "path";
import { DATA_DIR } from "./storage";
import { getAgentId } from "./agentMeta";
import { isPackagedAgentApp, readEmbeddedGeoWebBaseUrl } from "./runtimeEnv";
import { migrateAgentServerUrl, resolvePackagedDefaultServerUrl } from "./localAgentServerUrl";

export type AgentTaskConfig = {
  serverUrl: string;
  agentApiKey: string;
  localAgentId: string;
  serverUrlUserConfigured?: boolean;
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

function factoryDefaults(): AgentTaskConfig {
  const isPackaged = isPackagedAgentApp();
  const geoWebBaseUrl = readEmbeddedGeoWebBaseUrl();
  return {
    serverUrl: resolvePackagedDefaultServerUrl(geoWebBaseUrl, isPackaged),
    agentApiKey: "",
    localAgentId: "",
    serverUrlUserConfigured: false,
    pollIntervalSeconds: 15,
    autoStartPolling: false,
    logRetentionDays: 14,
    maxTasksPerCycle: DEFAULT_MAX_TASKS_PER_CYCLE,
    launchAtLogin: false,
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeConfig(parsed: Partial<AgentTaskConfig>): AgentTaskConfig {
  const pollIntervalSeconds = Math.max(
    5,
    parsed.pollIntervalSeconds ??
      (parsed.pollIntervalMs ? Math.round(parsed.pollIntervalMs / 1000) : 15),
  );
  const migrated = migrateAgentServerUrl({
    serverUrl: parsed.serverUrl,
    serverUrlUserConfigured: parsed.serverUrlUserConfigured,
    isPackaged: isPackagedAgentApp(),
    geoWebBaseUrl: readEmbeddedGeoWebBaseUrl(),
  });
  return {
    serverUrl: migrated.serverUrl,
    serverUrlUserConfigured: migrated.serverUrlUserConfigured,
    agentApiKey: parsed.agentApiKey ?? "",
    localAgentId: parsed.localAgentId?.trim() || getAgentId(),
    pollIntervalSeconds,
    autoStartPolling: Boolean(parsed.autoStartPolling ?? parsed.autoPoll ?? false),
    logRetentionDays: Math.max(1, parsed.logRetentionDays ?? 14),
    maxTasksPerCycle: Math.max(1, Math.min(3, parsed.maxTasksPerCycle ?? DEFAULT_MAX_TASKS_PER_CYCLE)),
    launchAtLogin: Boolean(parsed.launchAtLogin),
  };
}

export function readAgentConfig(): AgentTaskConfig {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    const initial = normalizeConfig(factoryDefaults());
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(toPersisted(initial), null, 2), "utf-8");
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as Partial<AgentTaskConfig>;
    const normalized = normalizeConfig(parsed);
    const persisted = toPersisted(normalized);
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as Partial<AgentTaskConfig>;
    if (
      raw.serverUrl !== normalized.serverUrl ||
      Boolean(raw.serverUrlUserConfigured) !== Boolean(normalized.serverUrlUserConfigured)
    ) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(persisted, null, 2), "utf-8");
    }
    return normalized;
  } catch {
    return normalizeConfig(factoryDefaults());
  }
}

function toPersisted(cfg: AgentTaskConfig) {
  return {
    serverUrl: cfg.serverUrl,
    serverUrlUserConfigured: Boolean(cfg.serverUrlUserConfigured),
    agentApiKey: cfg.agentApiKey,
    localAgentId: cfg.localAgentId,
    pollIntervalSeconds: cfg.pollIntervalSeconds,
    autoStartPolling: cfg.autoStartPolling,
    logRetentionDays: cfg.logRetentionDays,
    maxTasksPerCycle: cfg.maxTasksPerCycle,
    launchAtLogin: cfg.launchAtLogin,
  };
}

export function writeAgentConfig(
  patch: Partial<AgentTaskConfig> & { resetServerUrlToOnline?: boolean },
): AgentTaskConfig {
  const current = readAgentConfig();
  let merged: Partial<AgentTaskConfig> & { resetServerUrlToOnline?: boolean } = { ...current, ...patch };

  if (patch.resetServerUrlToOnline) {
    merged = {
      ...merged,
      serverUrl: resolvePackagedDefaultServerUrl(readEmbeddedGeoWebBaseUrl(), isPackagedAgentApp()),
      serverUrlUserConfigured: false,
    };
  } else if (typeof patch.serverUrl === "string") {
    merged.serverUrlUserConfigured = patch.serverUrlUserConfigured ?? true;
  }

  const next = normalizeConfig(merged);
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(toPersisted(next), null, 2), "utf-8");
  return next;
}

export function getPollIntervalMs(): number {
  return readAgentConfig().pollIntervalSeconds * 1000;
}
