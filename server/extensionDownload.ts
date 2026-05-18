import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import AdmZip from "adm-zip";
import type { Request } from "express";
import { TRPCError } from "@trpc/server";

const EXTENSION_ZIP_RELATIVE = "client/public/browser-extension.zip";
const AUTO_CONFIG_MARKER = "// 自动配置（安装时生成）";

function escapeJsSingleQuoted(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function resolveServerUrlFromRequest(req: Request): string {
  const host = req.headers.host;
  if (!host) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "无法识别服务器地址" });
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  let protocol = req.protocol || "http";
  if (forwardedProto) {
    const raw = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
    const first = raw?.split(",")[0]?.trim();
    if (first) protocol = first;
  }

  return `${protocol}://${host}`.replace(/\/$/, "");
}

function stripExistingAutoConfig(source: string): string {
  if (!source.includes(AUTO_CONFIG_MARKER)) return source;
  const lines = source.split("\n");
  const start = lines.findIndex(line => line.includes(AUTO_CONFIG_MARKER));
  if (start < 0) return source;

  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("const ") && !lines[end].startsWith("chrome.alarms")) {
    end += 1;
  }
  while (end < lines.length && lines[end].trim() === "") {
    end += 1;
  }
  return lines.slice(end).join("\n");
}

function buildAutoConfigPrefix(serverUrl: string, apiKey: string): string {
  return `${AUTO_CONFIG_MARKER}
chrome.storage.local.set({
  serverUrl: '${escapeJsSingleQuoted(serverUrl)}',
  apiKey: '${escapeJsSingleQuoted(apiKey)}'
});

`;
}

export function buildCustomExtensionZip(serverUrl: string, apiKey: string): Buffer {
  const zipPath = join(process.cwd(), EXTENSION_ZIP_RELATIVE);
  if (!existsSync(zipPath)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "插件安装包不存在，请联系管理员" });
  }

  const zip = new AdmZip(readFileSync(zipPath));
  const entry = zip.getEntry("background.js");
  if (!entry) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "插件包格式异常：缺少 background.js" });
  }

  const original = entry.getData().toString("utf8");
  const cleaned = stripExistingAutoConfig(original);
  const updated = buildAutoConfigPrefix(serverUrl, apiKey) + cleaned;
  zip.updateFile("background.js", Buffer.from(updated, "utf8"));
  return zip.toBuffer();
}
