import fs from "fs";
import os from "os";
import path from "path";
import { readAgentConfig } from "./agentConfig";
import { AGENT_VERSION, loadOrCreateAgentMeta } from "./agentMeta";
import { listRecentTaskLogs } from "./taskLogStore";
import { getAgentRoot } from "./agentPaths";
import { DATA_DIR, getAccountsFilePath, readAccounts } from "./storage";

const DIAGNOSTICS_DIR = path.join(getAgentRoot(), "diagnostics");

function copyFileSafe(src: string, dest: string) {
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
}

export function exportDiagnosticBundle(): { ok: boolean; path: string; message: string } {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(DIAGNOSTICS_DIR, `diagnostic-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const cfg = readAgentConfig();
  const meta = loadOrCreateAgentMeta();
  const accounts = readAccounts();

  const safeConfig = {
    serverUrl: cfg.serverUrl,
    localAgentId: cfg.localAgentId,
    pollIntervalSeconds: cfg.pollIntervalSeconds,
    autoStartPolling: cfg.autoStartPolling,
    logRetentionDays: cfg.logRetentionDays,
    maxTasksPerCycle: cfg.maxTasksPerCycle,
    launchAtLogin: cfg.launchAtLogin,
    agentApiKey: cfg.agentApiKey ? "[REDACTED]" : "",
  };

  const safeAccounts = {
    accounts: accounts.accounts.map(a => ({
      profileId: a.profileId,
      platform: a.platform,
      accountName: a.accountName,
      sessionStatus: a.sessionStatus,
      lastCheckedAt: a.lastCheckedAt,
      lastOpenedAt: a.lastOpenedAt,
      lastPublishAt: a.lastPublishAt ?? null,
      createdAt: a.createdAt,
    })),
  };

  fs.writeFileSync(path.join(outDir, "config.redacted.json"), JSON.stringify(safeConfig, null, 2));
  fs.writeFileSync(path.join(outDir, "accounts.redacted.json"), JSON.stringify(safeAccounts, null, 2));
  fs.writeFileSync(
    path.join(outDir, "app-info.json"),
    JSON.stringify(
      {
        appVersion: AGENT_VERSION,
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        electron: process.versions.electron,
        hostname: os.hostname(),
        agentMeta: meta,
        dataDir: DATA_DIR,
        note: "不包含 Cookie、profile 浏览器目录或 agentApiKey 明文",
      },
      null,
      2,
    ),
  );

  const logsDir = path.join(outDir, "task-logs");
  fs.mkdirSync(logsDir, { recursive: true });
  for (const log of listRecentTaskLogs(30)) {
    fs.writeFileSync(path.join(logsDir, `task-${log.taskId}.json`), JSON.stringify(log, null, 2));
  }

  copyFileSafe(getAccountsFilePath(), path.join(outDir, "_skipped-accounts-full.json.readme.txt"));
  fs.writeFileSync(
    path.join(outDir, "README.txt"),
    "GEO 本地发布客户端诊断包。不含 passwords/cookies/profile 目录。",
  );

  return { ok: true, path: outDir, message: `诊断包已导出：${outDir}` };
}
