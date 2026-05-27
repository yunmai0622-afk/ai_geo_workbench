import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("agentApi", {
  getDashboard: () => ipcRenderer.invoke("agent:getDashboard"),
  getPollingState: () => ipcRenderer.invoke("agent:getPollingState"),
  getConfig: () => ipcRenderer.invoke("agent:getConfig"),
  saveConfig: (patch: Record<string, unknown>) => ipcRenderer.invoke("agent:saveConfig", patch),
  resetServerUrlToOnline: () => ipcRenderer.invoke("agent:saveConfig", { resetServerUrlToOnline: true }),
  testServerConnection: () => ipcRenderer.invoke("agent:testServerConnection"),
  pollOnce: () => ipcRenderer.invoke("agent:pollOnce"),
  startPolling: () => ipcRenderer.invoke("agent:startPolling"),
  stopPolling: () => ipcRenderer.invoke("agent:stopPolling"),
  createPlatformProfile: (platform: string) => ipcRenderer.invoke("agent:createPlatformProfile", platform),
  listAccounts: () => ipcRenderer.invoke("agent:listAccounts"),
  openLoginWindow: (profileId: string) => ipcRenderer.invoke("agent:openLoginWindow", profileId),
  detectAccount: (profileId: string) => ipcRenderer.invoke("agent:detectAccount", profileId),
  openWritePage: (profileId: string, clickSource?: string) =>
    ipcRenderer.invoke("agent:openWritePage", profileId, clickSource),
  deleteProfile: (profileId: string) => ipcRenderer.invoke("agent:deleteProfile", profileId),
  markRelogin: (profileId: string) => ipcRenderer.invoke("agent:markRelogin", profileId),
  getTaskLog: (taskId: number) => ipcRenderer.invoke("agent:getTaskLog", taskId),
  listLocalLogs: () => ipcRenderer.invoke("agent:listLocalLogs"),
  openDataDir: () => ipcRenderer.invoke("agent:openDataDir"),
  exportDiagnostics: () => ipcRenderer.invoke("agent:exportDiagnostics"),
  openGeoWeb: (target: "contentProduction" | "publishRecords" | "platformAccounts") =>
    ipcRenderer.invoke("agent:openGeoWeb", target),
  captureWindowPng: (filename: string) => ipcRenderer.invoke("agent:captureWindowPng", filename),
  onStateChanged: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("agent:state-changed", handler);
    return () => ipcRenderer.removeListener("agent:state-changed", handler);
  },
  onFocusTab: (cb: (tab: string) => void) => {
    const handler = (_: unknown, tab: string) => cb(tab);
    ipcRenderer.on("agent:focus-tab", handler);
    return () => ipcRenderer.removeListener("agent:focus-tab", handler);
  },
  onLogLine: (cb: (payload: { line: string; isErr: boolean }) => void) => {
    const handler = (_: unknown, payload: { line: string; isErr: boolean }) => cb(payload);
    ipcRenderer.on("agent:log-line", handler);
    return () => ipcRenderer.removeListener("agent:log-line", handler);
  },
});
