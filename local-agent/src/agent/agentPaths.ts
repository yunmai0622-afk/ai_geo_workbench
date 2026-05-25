import path from "path";
import { app } from "electron";

/**
 * 开发：local-agent 目录；安装包：Electron userData（可写，不在 app.asar 内）。
 */
export function getAgentRoot(): string {
  if (app.isPackaged) {
    return app.getPath("userData");
  }
  return path.resolve(__dirname, "..", "..");
}
