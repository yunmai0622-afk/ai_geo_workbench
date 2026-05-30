import { app } from "electron";
import fs from "fs";
import os from "os";
import path from "path";
import { DATA_DIR } from "./storage";

export type AgentMetaFile = {
  agentId: string;
  deviceName: string;
  createdAt: string;
  lastStartedAt: string;
};

const AGENT_JSON = path.join(DATA_DIR, "agent.json");
export const AGENT_VERSION = app.getVersion();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadOrCreateAgentMeta(): AgentMetaFile {
  ensureDataDir();
  const now = new Date().toISOString();
  if (fs.existsSync(AGENT_JSON)) {
    const parsed = JSON.parse(fs.readFileSync(AGENT_JSON, "utf-8")) as AgentMetaFile;
    if (parsed.agentId) {
      const next = { ...parsed, lastStartedAt: now };
      fs.writeFileSync(AGENT_JSON, JSON.stringify(next, null, 2), "utf-8");
      return next;
    }
  }
  const meta: AgentMetaFile = {
    agentId: `agent_${Date.now()}`,
    deviceName: os.hostname(),
    createdAt: now,
    lastStartedAt: now,
  };
  fs.writeFileSync(AGENT_JSON, JSON.stringify(meta, null, 2), "utf-8");
  return meta;
}

export function getAgentId(): string {
  return loadOrCreateAgentMeta().agentId;
}
