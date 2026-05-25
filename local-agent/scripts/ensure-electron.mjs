#!/usr/bin/env node
/**
 * 校验 Electron 二进制是否已下载；未安装时给出可操作的修复命令。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronPkg = path.join(root, "node_modules", "electron", "package.json");
const electronIndex = path.join(root, "node_modules", "electron", "index.js");

if (!fs.existsSync(electronIndex)) {
  console.error("[local-agent] 未找到 electron 包，请执行: cd local-agent && npm install");
  process.exit(1);
}

try {
  const { createRequire } = await import("module");
  const require = createRequire(electronIndex);
  const binary = require("electron");
  if (typeof binary !== "string" || !fs.existsSync(binary)) {
    throw new Error(`binary missing: ${String(binary)}`);
  }
  console.log("[local-agent] Electron 二进制就绪:", binary);
} catch (e) {
  console.error("[local-agent] Electron 未正确安装:", e instanceof Error ? e.message : e);
  console.error("请执行（国内网络建议已配置 .npmrc 镜像）：");
  console.error("  cd local-agent");
  console.error("  rm -rf node_modules/electron");
  console.error("  npm install");
  console.error("或：ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install electron --save-dev");
  process.exit(1);
}
