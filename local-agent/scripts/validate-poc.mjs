#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "package.json",
  "src/main.ts",
  "src/preload.ts",
  "src/agent/profileManager.ts",
  "src/agent/zhihuAdapter.ts",
  "src/agent/localServer.ts",
  "src/agent/agentMeta.ts",
  "src/agent/storage.ts",
  "src/agent/taskClient.ts",
  "src/agent/publishWorker.ts",
  "src/agent/pollingManager.ts",
  "src/agent/taskLogStore.ts",
  "src/agent/dashboard.ts",
  "src/renderer/app.js",
  "src/agent/platforms/zhihuPublisher.ts",
  "src/agent/platforms/publisherFactory.ts",
  "src/agent/platformActions.ts",
  "src/agent/agentConfig.ts",
  "src/agent/geoWebNavigation.ts",
  "src/agent/writePageLogStore.ts",
  "src/renderer/index.html",
  "dist/main.js",
  "dist/preload.js",
];

for (const rel of required) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    console.error("missing", rel);
    process.exit(1);
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf-8");
const zhihu = fs.readFileSync(path.join(root, "src/agent/zhihuAdapter.ts"), "utf-8");

for (const ipc of [
  "agent:getDashboard",
  "agent:startPolling",
  "agent:stopPolling",
  "agent:pollOnce",
  "agent:deleteProfile",
  "agent:exportDiagnostics",
  "agent:listAccounts",
  "agent:getConfig",
  "agent:openGeoWeb",
]) {
  if (!main.includes(ipc)) {
    console.error("missing ipc", ipc);
    process.exit(1);
  }
}

const browser = fs.readFileSync(path.join(root, "src/agent/platforms/browserSession.ts"), "utf-8");
if (!browser.includes("launchPersistentContext")) {
  console.error("missing launchPersistentContext");
  process.exit(1);
}

const server = fs.readFileSync(path.join(root, "src/agent/localServer.ts"), "utf-8");
if (!server.includes("/health") || !server.includes("39888")) {
  console.error("missing local HTTP server");
  process.exit(1);
}

for (const needle of [
  "ensureMainWindowVisible",
  "ready-to-show",
  "did-fail-load",
  'app.on("activate"',
  "resolvePackagedFile",
  "show: false",
]) {
  if (!main.includes(needle)) {
    console.error("main.ts missing window lifecycle:", needle);
    process.exit(1);
  }
}
const publisher = fs.readFileSync(path.join(root, "src/agent/platforms/basePublisher.ts"), "utf-8");
if (!publisher.includes("cover_upload_skipped")) {
  console.error("missing cover_upload_skipped log");
  process.exit(1);
}
if (/password|mock.*success/i.test(publisher)) {
  console.error("forbidden pattern in zhihuAdapter");
  process.exit(1);
}

console.log("validate-poc ok", pkg.name);
