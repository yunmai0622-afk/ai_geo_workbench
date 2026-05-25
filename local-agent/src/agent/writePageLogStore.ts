import fs from "fs";
import path from "path";
import { DATA_DIR } from "./storage";

export type WritePageStepLog = {
  step: string;
  status: "ok" | "failed" | "skipped" | "manual_required";
  message?: string;
  url?: string;
  errorType?: string;
  httpStatus?: number;
  clickSource?: string;
  layer?: "electron" | "zhihu" | "web" | "local_api";
  createdAt: string;
};

export type WritePageLogFile = {
  profileId: string;
  platform: string;
  clickSource: string;
  startedAt: string;
  finishedAt?: string;
  finalUrl?: string;
  finalStatus?: "success" | "manual_required" | "failed";
  errorType?: string;
  logs: WritePageStepLog[];
};

const LOGS_DIR = path.join(DATA_DIR, "logs");
const sessions = new Map<string, WritePageLogFile>();

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function sessionPath(profileId: string, sessionId: string) {
  const safe = profileId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(LOGS_DIR, `open-write-${safe}-${sessionId}.json`);
}

function latestPath(profileId: string) {
  const safe = profileId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(LOGS_DIR, `open-write-latest-${safe}.json`);
}

function writeLog(file: WritePageLogFile, sessionId: string) {
  ensureLogsDir();
  fs.writeFileSync(sessionPath(file.profileId, sessionId), JSON.stringify(file, null, 2), "utf-8");
  fs.writeFileSync(latestPath(file.profileId), JSON.stringify(file, null, 2), "utf-8");
}

export function startWritePageLog(input: {
  profileId: string;
  platform: string;
  clickSource: string;
}): { sessionId: string; logPath: string } {
  const sessionId = String(Date.now());
  const entry: WritePageLogFile = {
    ...input,
    startedAt: new Date().toISOString(),
    logs: [],
  };
  sessions.set(sessionId, entry);
  writeLog(entry, sessionId);
  return { sessionId, logPath: sessionPath(input.profileId, sessionId) };
}

export function appendWritePageLogStep(
  sessionId: string,
  step: Omit<WritePageStepLog, "createdAt"> & { createdAt?: string },
): void {
  const line: WritePageStepLog = { ...step, createdAt: step.createdAt ?? new Date().toISOString() };
  const entry = sessions.get(sessionId);
  if (!entry) return;
  entry.logs.push(line);
  writeLog(entry, sessionId);
}

export function finishWritePageLog(
  sessionId: string,
  patch: Pick<WritePageLogFile, "finalStatus" | "errorType" | "finalUrl" | "finishedAt">,
): string | null {
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  Object.assign(entry, { finishedAt: patch.finishedAt ?? new Date().toISOString(), ...patch });
  writeLog(entry, sessionId);
  return latestPath(entry.profileId);
}
