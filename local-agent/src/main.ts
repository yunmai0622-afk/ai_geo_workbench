import { app, BrowserWindow, ipcMain, shell } from "electron";
import fs from "fs";
import path from "path";
import { readAgentConfig, writeAgentConfig } from "./agent/agentConfig";
import { buildDashboard, testConnection } from "./agent/dashboard";
import { exportDiagnosticBundle } from "./agent/diagnostics";
import { startLocalAgentServer } from "./agent/localServer";
import { getLocalHttpStartupError, setLocalHttpStartupError } from "./agent/localHttpState";
import {
  deleteLocalProfile,
  markAccountNeedsRelogin,
  createPlatformProfile,
  createZhihuProfile,
} from "./agent/profileManager";
import {
  getPollingState,
  pollOnce,
  resumePollingIfEnabled,
  setWorkerLogger,
  startPolling,
  stopPolling,
} from "./agent/pollingManager";
import { readTaskLog, listRecentTaskLogs } from "./agent/taskLogStore";
import { DATA_DIR } from "./agent/storage";
import type { StoredPlatform } from "./agent/storage";
import {
  detectPlatformAccount,
  openLoginWindow,
  openPlatformWritePage,
} from "./agent/platformActions";
import { readAccounts } from "./agent/storage";
import { resolveGeoWebUrl, type GeoWebNavigationTarget } from "./agent/geoWebNavigation";

let mainWindow: BrowserWindow | null = null;
let httpServer: ReturnType<typeof startLocalAgentServer> | null = null;

function broadcastState() {
  mainWindow?.webContents.send("agent:state-changed");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    show: true,
    title: "GEO 本地发布客户端",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const htmlPath = path.join(__dirname, "renderer", "index.html");
  void mainWindow.loadFile(htmlPath).catch(err => {
    console.error("[electron] 加载界面失败:", htmlPath, err);
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function startHttpServerSafely() {
  const server = startLocalAgentServer();
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      setLocalHttpStartupError(
        "端口 39888 已被占用：请关闭其他 local-agent 进程（含仅 HTTP 的 node 启动方式），再重新 npm run dev",
      );
      console.error(`[local-agent] ${getLocalHttpStartupError()}`);
      broadcastState();
      return;
    }
    setLocalHttpStartupError(err.message);
    console.error("[local-agent] HTTP 启动失败:", err.message);
    broadcastState();
  });
  return server;
}

app.whenReady().then(() => {
  setLocalHttpStartupError(null);
  httpServer = startHttpServerSafely();
  readAgentConfig();
  setWorkerLogger((line, isErr) => {
    console.log(isErr ? `[ERR] ${line}` : line);
    mainWindow?.webContents.send("agent:log-line", { line, isErr: Boolean(isErr) });
  });
  resumePollingIfEnabled();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopPolling();
  httpServer?.close();
});

ipcMain.handle("agent:getDashboard", async () => buildDashboard());

ipcMain.handle("agent:captureWindowPng", async (_e, filename: string) => {
  if (!mainWindow) return { ok: false, message: "窗口未就绪" };
  try {
    const image = await mainWindow.capturePage();
    const outDir = path.resolve(__dirname, "..", "..", "artifacts");
    fs.mkdirSync(outDir, { recursive: true });
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const outPath = path.join(outDir, safe.endsWith(".png") ? safe : `${safe}.png`);
    fs.writeFileSync(outPath, image.toPNG());
    return { ok: true, path: outPath };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
});
ipcMain.handle("agent:getPollingState", async () => getPollingState());

ipcMain.handle("agent:createZhihuProfile", async () => {
  const account = createZhihuProfile();
  broadcastState();
  return { ok: true, account };
});

ipcMain.handle("agent:createPlatformProfile", async (_e, platform: string) => {
  const allowed: StoredPlatform[] = ["zhihu", "sohu", "baijiahao", "toutiao"];
  if (!allowed.includes(platform as StoredPlatform)) {
    return { ok: false, message: `不支持的平台: ${platform}` };
  }
  const account = createPlatformProfile(platform as StoredPlatform);
  broadcastState();
  return { ok: true, account };
});

ipcMain.handle("agent:listAccounts", async () => readAccounts());

ipcMain.handle("agent:openLoginWindow", async (_e, profileId: string) => {
  const result = await openLoginWindow(profileId);
  broadcastState();
  return result;
});

ipcMain.handle("agent:detectAccount", async (_e, profileId: string) => {
  const result = await detectPlatformAccount(profileId);
  broadcastState();
  return result;
});

ipcMain.handle("agent:openWritePage", async (_e, profileId: string, clickSource?: string) =>
  openPlatformWritePage(profileId, typeof clickSource === "string" ? clickSource : "client_publish_button"),
);

ipcMain.handle("agent:deleteProfile", async (_e, profileId: string) => {
  const result = await deleteLocalProfile(profileId);
  broadcastState();
  return result;
});

ipcMain.handle("agent:markRelogin", async (_e, profileId: string) => {
  markAccountNeedsRelogin(profileId);
  const login = await openLoginWindow(profileId);
  broadcastState();
  return { ok: true, message: "已标记需重新登录，并打开登录窗口", login };
});

ipcMain.handle("agent:getConfig", async () => {
  const cfg = readAgentConfig();
  return {
    ...cfg,
    agentApiKey: cfg.agentApiKey,
    dataDir: DATA_DIR,
  };
});

ipcMain.handle("agent:saveConfig", async (_e, patch: Record<string, unknown>) => {
  const next = writeAgentConfig({
    serverUrl: typeof patch.serverUrl === "string" ? patch.serverUrl : undefined,
    agentApiKey: typeof patch.agentApiKey === "string" ? patch.agentApiKey : undefined,
    pollIntervalSeconds:
      typeof patch.pollIntervalSeconds === "number" ? patch.pollIntervalSeconds : undefined,
    autoStartPolling:
      typeof patch.autoStartPolling === "boolean"
        ? patch.autoStartPolling
        : typeof patch.autoPoll === "boolean"
          ? patch.autoPoll
          : undefined,
    logRetentionDays: typeof patch.logRetentionDays === "number" ? patch.logRetentionDays : undefined,
    maxTasksPerCycle: typeof patch.maxTasksPerCycle === "number" ? patch.maxTasksPerCycle : undefined,
    launchAtLogin: typeof patch.launchAtLogin === "boolean" ? patch.launchAtLogin : undefined,
  });
  if (next.autoStartPolling) startPolling();
  else stopPolling();
  broadcastState();
  return { ...next, dataDir: DATA_DIR };
});

ipcMain.handle("agent:testServerConnection", async () => {
  const r = await testConnection();
  broadcastState();
  return r;
});

ipcMain.handle("agent:pollOnce", async () => {
  const result = await pollOnce();
  broadcastState();
  return result;
});

ipcMain.handle("agent:startPolling", async () => {
  startPolling();
  broadcastState();
  return { ok: true };
});

ipcMain.handle("agent:stopPolling", async () => {
  stopPolling();
  broadcastState();
  return { ok: true };
});

ipcMain.handle("agent:listLocalLogs", async () => listRecentTaskLogs(50));
ipcMain.handle("agent:getTaskLog", async (_e, taskId: number) => readTaskLog(taskId));

ipcMain.handle("agent:openDataDir", async () => {
  await shell.openPath(DATA_DIR);
  return { ok: true };
});

ipcMain.handle("agent:exportDiagnostics", async () => {
  const result = exportDiagnosticBundle();
  if (result.ok) await shell.openPath(result.path);
  return result;
});

ipcMain.handle("agent:openGeoWeb", async (_e, target: GeoWebNavigationTarget) => {
  try {
    const url = resolveGeoWebUrl(target);
    await shell.openExternal(url);
    return { ok: true, url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
});

/** 兼容旧 IPC */
ipcMain.handle("agent:detectZhihuAccount", async (_e, profileId: string) =>
  detectPlatformAccount(profileId),
);
ipcMain.handle("agent:openZhihuWritePage", async (_e, profileId: string) =>
  openPlatformWritePage(profileId),
);
ipcMain.handle("agent:pollTasksOnce", async () => pollOnce());
ipcMain.handle("agent:startAutoPoll", async () => {
  startPolling();
  return { ok: true };
});
ipcMain.handle("agent:stopAutoPoll", async () => {
  stopPolling();
  return { ok: true };
});
