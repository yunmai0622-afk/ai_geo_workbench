import os from "os";
import path from "path";
import { app } from "electron";

/**
 * 开发：local-agent 目录；安装包：Electron userData（可写，不在 app.asar 内）。
 */
export function getAgentRoot(): string {
  if (app.isPackaged) {
    try {
      return app.getPath("userData");
    } catch (err) {
      console.warn("[agent] app.getPath(userData) 失败，使用 homedir 回退:", err);
      return path.join(os.homedir(), "Library", "Application Support", "GEO本地发布客户端");
    }
  }
  return path.resolve(__dirname, "..", "..");
}
