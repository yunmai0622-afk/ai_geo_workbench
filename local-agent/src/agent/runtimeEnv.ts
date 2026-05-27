import fs from "fs";
import path from "path";

export function isPackagedAgentApp(): boolean {
  try {
    const { app } = require("electron") as typeof import("electron");
    return app.isPackaged;
  } catch {
    return process.env.NODE_ENV === "production" && process.env.GEO_AGENT_DEV !== "1";
  }
}

/** 打包时写入 dist/geoWebBaseUrl.json，与 Web manifest 对齐 */
export function readEmbeddedGeoWebBaseUrl(): string | null {
  const candidates = [
    path.join(__dirname, "geoWebBaseUrl.json"),
    path.join(__dirname, "..", "geoWebBaseUrl.json"),
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as { geoWebBaseUrl?: string };
      if (typeof parsed.geoWebBaseUrl === "string" && /^https?:\/\//i.test(parsed.geoWebBaseUrl)) {
        return parsed.geoWebBaseUrl.trim().replace(/\/$/, "");
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}
