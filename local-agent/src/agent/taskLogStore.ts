import fs from "fs";
import path from "path";
import { readAgentConfig } from "./agentConfig";
import { DATA_DIR } from "./storage";

export type TaskStepLog = {
  step: string;
  status: "ok" | "failed" | "skipped";
  message?: string;
  selector?: string;
  createdAt: string;
};

export type TaskLogFile = {
  taskId: number;
  platform: string;
  profileId: string;
  title?: string;
  expectedAccountName?: string;
  finalStatus?: string;
  errorType?: string;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
  logs: TaskStepLog[];
};

const LOGS_DIR = path.join(DATA_DIR, "logs");
const memoryCache = new Map<number, TaskLogFile>();

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function logPath(taskId: number) {
  return path.join(LOGS_DIR, `task-${taskId}.json`);
}

export function startTaskLog(input: {
  taskId: number;
  platform: string;
  profileId: string;
  title?: string;
  expectedAccountName?: string;
}): TaskLogFile {
  ensureLogsDir();
  const entry: TaskLogFile = {
    ...input,
    startedAt: new Date().toISOString(),
    logs: [],
  };
  memoryCache.set(input.taskId, entry);
  fs.writeFileSync(logPath(input.taskId), JSON.stringify(entry, null, 2), "utf-8");
  return entry;
}

export function appendTaskLogStep(
  taskId: number,
  step: Omit<TaskStepLog, "createdAt"> & { createdAt?: string },
): void {
  const line: TaskStepLog = { ...step, createdAt: step.createdAt ?? new Date().toISOString() };
  let entry = memoryCache.get(taskId) ?? readTaskLog(taskId);
  if (!entry) {
    entry = {
      taskId,
      platform: "unknown",
      profileId: "",
      startedAt: new Date().toISOString(),
      logs: [],
    };
  }
  entry.logs.push(line);
  memoryCache.set(taskId, entry);
  ensureLogsDir();
  fs.writeFileSync(logPath(taskId), JSON.stringify(entry, null, 2), "utf-8");
}

export function finishTaskLog(
  taskId: number,
  patch: Pick<TaskLogFile, "finalStatus" | "errorType" | "errorMessage"> & { finishedAt?: string },
): void {
  const entry = memoryCache.get(taskId) ?? readTaskLog(taskId);
  if (!entry) return;
  const next = {
    ...entry,
    ...patch,
    finishedAt: patch.finishedAt ?? new Date().toISOString(),
  };
  memoryCache.set(taskId, next);
  fs.writeFileSync(logPath(taskId), JSON.stringify(next, null, 2), "utf-8");
}

export function persistTaskLogsFromOutcome(
  taskId: number,
  platform: string,
  profileId: string,
  title: string,
  expectedAccountName: string,
  finalStatus: string,
  errorType: string | undefined,
  errorMessage: string | undefined,
  rawLogs: Array<{ step: string; status: string; message?: string; selector?: string; createdAt: string }>,
): void {
  startTaskLog({ taskId, platform, profileId, title, expectedAccountName });
  for (const l of rawLogs) {
    appendTaskLogStep(taskId, {
      step: l.step,
      status: l.status as TaskStepLog["status"],
      message: l.message,
      selector: l.selector,
      createdAt: l.createdAt,
    });
  }
  finishTaskLog(taskId, { finalStatus, errorType, errorMessage });
}

export function readTaskLog(taskId: number): TaskLogFile | null {
  if (memoryCache.has(taskId)) return memoryCache.get(taskId)!;
  const p = logPath(taskId);
  if (!fs.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf-8")) as TaskLogFile;
    memoryCache.set(taskId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function listRecentTaskLogs(limit = 50): TaskLogFile[] {
  ensureLogsDir();
  const files = fs
    .readdirSync(LOGS_DIR)
    .filter(f => f.startsWith("task-") && f.endsWith(".json"))
    .map(f => {
      const id = Number(f.replace("task-", "").replace(".json", ""));
      return { id, mtime: fs.statSync(path.join(LOGS_DIR, f)).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);

  const out: TaskLogFile[] = [];
  for (const { id } of files) {
    const log = readTaskLog(id);
    if (log) out.push(log);
  }
  return out;
}

export function pruneOldTaskLogs(): number {
  const days = readAgentConfig().logRetentionDays;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  ensureLogsDir();
  let removed = 0;
  for (const f of fs.readdirSync(LOGS_DIR)) {
    if (!f.startsWith("task-") || !f.endsWith(".json")) continue;
    const p = path.join(LOGS_DIR, f);
    if (fs.statSync(p).mtimeMs < cutoff) {
      fs.unlinkSync(p);
      const id = Number(f.replace("task-", "").replace(".json", ""));
      memoryCache.delete(id);
      removed += 1;
    }
  }
  return removed;
}

export function getLogsDir(): string {
  ensureLogsDir();
  return LOGS_DIR;
}
