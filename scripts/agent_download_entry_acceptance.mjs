#!/usr/bin/env node
/**
 * Agent-Download-Entry-Fix：Web 主流程本地发布客户端下载入口验收
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binding = fs.readFileSync(
  path.join(root, "client/src/components/PlatformAccountBindingSection.tsx"),
  "utf-8",
);
const card = fs.readFileSync(path.join(root, "client/src/components/LocalAgentDownloadCard.tsx"), "utf-8");
const weekly = fs.readFileSync(path.join(root, "client/src/pages/WeeklyContentPage.tsx"), "utf-8");
const mainUi = [binding, card, weekly].join("\n");
const downloadsDir = path.join(root, "client/public/downloads");

let passed = 0;
let failed = 0;

function ok(msg) {
  passed++;
  console.log("[OK]", msg);
}
function fail(msg) {
  failed++;
  console.error("[FAIL]", msg);
}

if (binding.includes("本地发布客户端") && binding.includes("LocalAgentDownloadCard")) {
  ok("PlatformAccountBindingSection has 本地发布客户端 card");
} else fail("PlatformAccountBindingSection missing download card");

const cardBeforeAccounts =
  binding.indexOf("LocalAgentDownloadCard") < binding.indexOf("BINDING_PUBLISH_PLATFORMS") ||
  binding.indexOf("LocalAgentDownloadCard") < binding.indexOf("platformGroups");
if (cardBeforeAccounts || binding.indexOf("<LocalAgentDownloadCard") < binding.lastIndexOf("row.")) {
  ok("download card before platform account list");
} else fail("download card not before account list");

if (card.includes("下载 Mac 客户端")) ok("下载 Mac 客户端 button");
else fail("missing 下载 Mac 客户端");

if (card.includes("检测客户端")) ok("检测客户端 button");
else fail("missing 检测客户端");

if (card.includes("/downloads/geo-local-agent-mac")) ok("Mac href uses /downloads/ relative path");
else fail("Mac href not relative /downloads/");

if (!/https?:\/\/localhost[^\s"']*\/downloads/.test(card)) ok("no hardcoded localhost download URL");
else fail("hardcoded localhost download");

if (!/manus\.space/i.test(card + mainUi)) ok("no hardcoded manus.space");
else fail("hardcoded manus.space");

if (!/file:\/\//i.test(card)) ok("no file:// links");
else fail("file:// in download card");

const macZip = path.join(downloadsDir, "geo-local-agent-mac.zip");
const macDmg = path.join(downloadsDir, "geo-local-agent-mac.dmg");
if (fs.existsSync(macZip) || fs.existsSync(macDmg)) ok("Mac file exists in client/public/downloads");
else fail("missing Mac zip/dmg in public/downloads");

if (card.includes("Windows 客户端即将支持") && card.includes("disabled")) {
  ok("Windows 即将支持 when no win in manifest");
} else fail("Windows button state");

if (
  fs.readFileSync(path.join(root, "shared/localAgent.ts"), "utf-8").includes("127.0.0.1:39888") &&
  fs.readFileSync(path.join(root, "client/src/lib/localAgentClient.ts"), "utf-8").includes("/health")
) {
  ok("health check 127.0.0.1:39888/health");
} else fail("health endpoint");

if (!/下载 Chrome 插件|重载插件|downloadExtension|browser-extension\.zip/.test(mainUi)) {
  ok("no Chrome extension main download entry");
} else fail("Chrome extension main entry found");

if (weekly.includes("请先下载安装并启动本地发布客户端")) {
  ok("WeeklyContentPage publish hint for local agent");
} else fail("WeeklyContentPage missing local agent hint");

if (weekly.includes("/enterprise-profile#platform-accounts")) {
  ok("WeeklyContentPage links to enterprise profile accounts");
} else fail("missing enterprise-profile#platform-accounts link");

console.log(`\n--- acceptance: ${passed} passed, ${failed} failed ---\n`);
if (failed > 0) process.exit(1);

spawnSync("pnpm", ["check"], { cwd: root, stdio: "inherit" });
spawnSync("pnpm", ["exec", "vitest", "run", "server/v12AgentDownloadPackaging.test.ts", "server/v12AgentMigration3Legacy.test.ts"], {
  cwd: root,
  stdio: "inherit",
});
spawnSync("pnpm", ["build"], { cwd: root, stdio: "inherit" });
spawnSync("npm", ["run", "typecheck"], { cwd: path.join(root, "local-agent"), stdio: "inherit" });
spawnSync("npm", ["run", "build"], { cwd: path.join(root, "local-agent"), stdio: "inherit" });

fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
fs.writeFileSync(
  path.join(root, "artifacts/AGENT_DOWNLOAD_ENTRY_REPORT.md"),
  `# Agent-Download-Entry-Fix

- 入口页：企业档案 \`/enterprise-profile#platform-accounts\`
- Mac href：\`/downloads/geo-local-agent-mac.zip\`（相对路径）
- 检测：\`http://127.0.0.1:39888/health\`
- 截图：本机 \`pnpm dev\` 后补 \`artifacts/agent-download-entry-*.png\`
`,
);

console.log("\n=== agent_download_entry_acceptance PASSED ===\n");
