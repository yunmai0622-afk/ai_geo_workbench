#!/usr/bin/env node
/**
 * Agent-Mac-Dmg-Corruption-Fix：Mac zip 优先下载静态验收
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { inspectMacZipArtifact, isHtmlPayload } from "./lib/macAgentZipArtifact.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const downloadsDir = path.join(root, "client/public/downloads");
const macZip = path.join(downloadsDir, "geo-local-agent-mac.zip");
const cardPath = path.join(root, "client/src/components/LocalAgentDownloadCard.tsx");
const manifestPath = path.join(downloadsDir, "manifest.json");

const card = fs.readFileSync(cardPath, "utf-8");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
const mainUi = [
  card,
  fs.readFileSync(path.join(root, "client/src/components/PlatformAccountBindingSection.tsx"), "utf-8"),
  fs.readFileSync(path.join(root, "client/src/pages/WeeklyContentPage.tsx"), "utf-8"),
].join("\n");

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

const MIN_ZIP_BYTES = 50 * 1024 * 1024;

if (fs.existsSync(macZip)) ok("geo-local-agent-mac.zip exists");
else fail("missing geo-local-agent-mac.zip");

if (fs.existsSync(macZip)) {
  const inspected = inspectMacZipArtifact(macZip);
  if (inspected.ok) ok(`zip size ${((inspected.size ?? 0) / 1024 / 1024).toFixed(1)}MB > 50MB`);
  else fail(inspected.reason ?? `zip invalid (${inspected.size} bytes)`);
  if (isHtmlPayload(macZip)) fail("zip 内容为 HTML 假文件");
  else ok("zip 不是 HTML 假文件");
}

const unzip = spawnSync("unzip", ["-t", macZip], { encoding: "utf-8" });
if (unzip.status === 0 && /No errors detected/i.test(unzip.stdout + unzip.stderr)) {
  ok("unzip -t passed");
} else {
  fail(`unzip -t failed: ${unzip.stderr || unzip.stdout}`);
}

if (manifest.macZipUrl === "/downloads/geo-local-agent-mac.zip") {
  ok("manifest.macZipUrl -> /downloads/geo-local-agent-mac.zip");
} else {
  fail(`manifest.macZipUrl unexpected: ${manifest.macZipUrl}`);
}

if (manifest.macDmgUrl == null) ok("manifest.macDmgUrl is null (dmg hidden)");
else fail(`manifest.macDmgUrl should be null, got ${manifest.macDmgUrl}`);

if (manifest.sourceDir) fail(`manifest must not contain sourceDir: ${manifest.sourceDir}`);
else ok("manifest has no sourceDir");

if (JSON.stringify(manifest).includes("/Users/")) fail("manifest contains local absolute path");
else ok("manifest has no /Users/ local path");

const copyScript = fs.readFileSync(path.join(root, "scripts/copy_local_agent_download.mjs"), "utf-8");
if (
  copyScript.includes("inspectMacZipArtifact") &&
  (copyScript.includes("assertValidMacZipArtifact") || copyScript.includes("finalizeRelativeMacZip"))
) {
  ok("copy script validates zip artifact");
} else {
  fail("copy script missing zip artifact validation");
}

const viteTs = fs.readFileSync(path.join(root, "server/_core/vite.ts"), "utf-8");
if (viteTs.includes("registerDownloadArtifactGuard")) ok("serveStatic blocks SPA HTML fake zip");
else fail("vite.ts missing download artifact guard");

if (card.includes("isMacZipDownloadUrl") && card.includes("http://") && card.includes("https://")) {
  ok("LocalAgentDownloadCard supports absolute macZipUrl");
} else {
  fail("LocalAgentDownloadCard missing absolute URL support");
}

const pickFn = card.match(/function pickMacHref[\s\S]*?^}/m)?.[0] ?? "";
if (pickFn.includes("isMacZipDownloadUrl(zip)")) {
  ok("LocalAgentDownloadCard pickMacHref uses isMacZipDownloadUrl first");
} else {
  fail("pickMacHref must prefer zip via isMacZipDownloadUrl");
}

if (copyScript.includes("AGENT_MAC_ZIP_URL") && copyScript.includes("macDmgUrl: null")) {
  ok("copy_local_agent_download supports AGENT_MAC_ZIP_URL and macDmgUrl null");
} else {
  fail("copy script missing AGENT_MAC_ZIP_URL or macDmgUrl null");
}

if (card.includes("下载 Mac 客户端（推荐）")) ok('Mac button copy contains "推荐"');
else fail('Mac button missing "下载 Mac 客户端（推荐）"');

if (!/优先 dmg|\.dmg 推荐/i.test(card)) ok("card does not default to dmg recommendation");
else fail("card still recommends dmg by default");

if (!/https?:\/\/localhost[^\s"']*\/downloads/.test(card)) ok("no hardcoded localhost download URL");
else fail("hardcoded localhost download URL");

if (!/manus\.space/i.test(card + fs.readFileSync(manifestPath, "utf-8"))) ok("no hardcoded manus.space");
else fail("hardcoded manus.space");

if (!/file:\/\//i.test(card)) ok("no file:// download links");
else fail("file:// in card");

if (!/Chrome\s*插件|重载插件|下载插件|插件版本/.test(mainUi)) ok("no Chrome extension main copy");
else fail("Chrome extension main copy found");

if (!mainUi.includes("browser-extension.zip")) ok("browser-extension.zip not main download");
else fail("browser-extension.zip referenced as main download");

console.log(`\n--- acceptance: ${passed} passed, ${failed} failed ---\n`);
if (failed > 0) process.exit(1);
console.log("=== agent_mac_download_package_acceptance PASSED ===\n");
