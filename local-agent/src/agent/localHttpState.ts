/** Electron 主进程内本地 HTTP 启动状态（避免 dashboard ↔ main 循环依赖） */
let startupError: string | null = null;

export function setLocalHttpStartupError(message: string | null) {
  startupError = message;
}

export function getLocalHttpStartupError(): string | null {
  return startupError;
}
