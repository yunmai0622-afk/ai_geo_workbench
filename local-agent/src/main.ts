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
import { syncAccountAfterDetect, syncKnownProjectAccountStatuses } from "./agent/accountSync";
import { readAccounts } from "./agent/storage";
import { resolveGeoWebUrl, type GeoWebNavigationTarget } from "./agent/geoWebNavigation";

let mainWindow: BrowserWindow | null = null;
let httpServer: ReturnType<typeof startLocalAgentServer> | null = null;
let revealFallbackTimer: ReturnType<typeof setTimeout> | null = null;

const FALLBACK_LOAD_ERROR_HTML = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8" /><title>GEO 本地发布客户端</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:48px;color:#0f172a;line-height:1.6}
h1{font-size:20px}p{color:#475569}</style></head><body>
<h1>客户端界面加载失败</h1>
<p>请重新打开应用，或联系技术支持。可在「高级诊断」导出日志（若菜单可用）。</p>
</body></html>`;

function broadcastState() {
  mainWindow?.webContents.send("agent:state-changed");
}

function resolvePackagedFile(...segments: string[]): string {
  const candidates = [
    path.join(__dirname, ...segments),
    path.join(app.getAppPath(), "dist", ...segments),
  ];
  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, "app.asar", "dist", ...segments));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0]!;
}

function clearRevealFallbackTimer() {
  if (revealFallbackTimer) {
    clearTimeout(revealFallbackTimer);
    revealFallbackTimer = null;
  }
}

function revealMainWindow(win: BrowserWindow) {
  if (win.isDestroyed()) return;
  clearRevealFallbackTimer();
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
  if (process.platform === "darwin") {
    app.dock?.show();
    app.focus({ steal: true });
  }
}

function scheduleRevealFallback(win: BrowserWindow) {
  clearRevealFallbackTimer();
  revealFallbackTimer = setTimeout(() => {
    if (win.isDestroyed()) return;
    if (!win.isVisible()) {
      console.warn("[electron] ready-to-show 超时，强制显示主窗口");
      revealMainWindow(win);
    }
  }, 2000);
}

function attachWindowDiagnostics(win: BrowserWindow) {
  const wc = win.webContents;
  wc.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("[electron] did-fail-load", { errorCode, errorDescription, validatedURL });
    if (win.isDestroyed()) return;
    void win
      .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(FALLBACK_LOAD_ERROR_HTML)}`)
      .catch(err => console.error("[electron] fallback html failed:", err));
    revealMainWindow(win);
  });
  wc.on("render-process-gone", (_event, details) => {
    console.error("[electron] render-process-gone", details);
  });
  wc.on("unresponsive", () => {
    console.error("[electron] renderer unresponsive");
  });
  wc.on("responsive", () => {
    console.log("[electron] renderer responsive");
  });
}

async function loadMainRenderer(win: BrowserWindow) {
  const htmlPath = resolvePackagedFile("renderer", "index.html");
  const preloadPath = resolvePackagedFile("preload.js");
  console.log("[electron] load renderer", { htmlPath, preloadPath, packaged: app.isPackaged });
  if (!fs.existsSync(htmlPath)) {
    console.error("[electron] renderer index missing:", htmlPath);
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(FALLBACK_LOAD_ERROR_HTML)}`);
    return;
  }
  try {
    await win.loadFile(htmlPath);
  } catch (err) {
    console.error("[electron] loadFile failed:", htmlPath, err);
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(FALLBACK_LOAD_ERROR_HTML)}`);
  }
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    revealMainWindow(mainWindow);
    return;
  }

  const preloadPath = resolvePackagedFile("preload.js");
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    show: false,
    center: true,
    title: "GEO 本地发布客户端",
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    clearRevealFallbackTimer();
  });

  attachWindowDiagnostics(mainWindow);
  scheduleRevealFallback(mainWindow);

  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) revealMainWindow(mainWindow);
  });

  void loadMainRenderer(mainWindow).catch(err => {
    console.error("[electron] loadMainRenderer error:", err);
    if (mainWindow && !mainWindow.isDestroyed()) revealMainWindow(mainWindow);
  });
}

function ensureMainWindowVisible() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    revealMainWindow(mainWindow);
    return;
  }
  createWindow();
}

function focusAccountsTabInRenderer() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  revealMainWindow(mainWindow);
  mainWindow.webContents.send("agent:focus-tab", "accounts");
}

function startHttpServerSafely() {
  const server = startLocalAgentServer({
    onFocusAccountsTab: focusAccountsTabInRenderer,
  });
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

app.on("activate", () => {
  ensureMainWindowVisible();
});

app.whenReady().then(() => {
  createWindow();

  try {
    setLocalHttpStartupError(null);
    httpServer = startHttpServerSafely();
    readAgentConfig();
    setWorkerLogger((line, isErr) => {
      console.log(isErr ? `[ERR] ${line}` : line);
      mainWindow?.webContents.send("agent:log-line", { line, isErr: Boolean(isErr) });
    });
    resumePollingIfEnabled();
    void syncKnownProjectAccountStatuses();
  } catch (err) {
    console.error("[electron] 后台服务初始化失败（主窗口仍应可见）:", err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      revealMainWindow(mainWindow);
    }
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopPolling({ log: false });
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
  const allowed: StoredPlatform[] = ["zhihu", "sohu", "baijiahao", "toutiao", "netease"];
  if (!allowed.includes(platform as StoredPlatform)) {
    const pendingMsg =
      platform === "xiaohongshu" || platform === "wechat"
        ? `平台「${platform}」即将支持账号环境创建，当前支持：知乎、搜狐号、百家号、头条号、网易号`
        : `不支持的平台: ${platform}`;
    return { ok: false, message: pendingMsg };
  }
  try {
    const account = createPlatformProfile(platform as StoredPlatform);
    const login = await openLoginWindow(account.profileId);
    broadcastState();
    return {
      ok: login.ok,
      account,
      message: login.ok
        ? "已创建账号环境，正在打开登录页，请在浏览器中完成登录"
        : `已创建账号环境，但打开浏览器失败：${login.message}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `创建账号环境失败：${message}` };
  }
});

ipcMain.handle("agent:listAccounts", async () => readAccounts());

ipcMain.handle("agent:openLoginWindow", async (_e, profileId: string) => {
  const result = await openLoginWindow(profileId);
  broadcastState();
  return result;
});

ipcMain.handle("agent:detectAccount", async (_e, profileId: string) => {
  const result = await detectPlatformAccount(profileId);
  void syncAccountAfterDetect(profileId).catch(err => {
    console.warn("[local-agent] account status sync failed", err instanceof Error ? err.message : err);
  });
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
    serverUrlUserConfigured:
      typeof patch.serverUrlUserConfigured === "boolean" ? patch.serverUrlUserConfigured : undefined,
    resetServerUrlToOnline: patch.resetServerUrlToOnline === true,
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
  if (next.autoStartPolling) startPolling({ restartReason: "配置已更新" });
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

ipcMain.handle("agent:openExternalUrl", async (_e, url: string) => {
  const href = typeof url === "string" ? url.trim() : "";
  if (!/^https?:\/\//i.test(href)) {
    return { ok: false, message: "下载链接无效" };
  }
  try {
    await shell.openExternal(href);
    return { ok: true, url: href };
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
