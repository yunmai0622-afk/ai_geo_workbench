#!/usr/bin/env node
/**
 * Agent-Windows-Client-Packaging 验收
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { inspectWinExeArtifact, inspectWinZipArtifact, isHtmlPayload } from "./lib/localAgentDownloadArtifact.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf-8");

const pkg = JSON.parse(read("local-agent/package.json"));
const card = read("client/src/components/LocalAgentDownloadCard.tsx");
const manifestPath = path.join(root, "client/public/downloads/manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
const mainUi = card + read("client/src/pages/AssetCenter.tsx") + read("client/src/components/PlatformAccountBindingSection.tsx");

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

if (pkg.scripts?.["package:win"]) ok("package:win script exists");
else fail("missing package:win");

if (pkg.build?.win?.target?.length) ok("electron-builder win target configured");
else fail("missing build.win");

const winSetup = manifest.winSetupUrl;
const winZip = manifest.winZipUrl;

if (winSetup || winZip) ok("manifest has Windows download URL");
else fail("manifest missing winSetupUrl and winZipUrl");

const copyScript = read("scripts/copy_local_agent_download.mjs");
if (copyScript.includes("winZipSha256") && copyScript.includes("AGENT_WIN_ZIP_URL")) {
  ok("copy script validates Windows artifacts");
} else {
  fail("copy script missing Windows sha256 / AGENT_WIN_ZIP_URL");
}

if (manifest.sourceDir) fail("manifest has sourceDir");
else ok("manifest has no sourceDir");

if (winSetup?.startsWith("/downloads/")) {
  const p = path.join(root, "client/public", winSetup.replace(/^\//, ""));
  const inspected = inspectWinExeArtifact(p);
  if (inspected.ok) ok(`winSetup valid (${((inspected.size ?? 0) / 1024 / 1024).toFixed(1)} MB)`);
  else fail(`winSetup invalid: ${inspected.reason}`);
  if (isHtmlPayload(p)) fail("winSetup is HTML fake file");
  if (manifest.winSetupSha256) ok("manifest has winSetupSha256");
} else if (winSetup) {
  ok("winSetup uses external URL");
}

if (winZip?.startsWith("/downloads/")) {
  const p = path.join(root, "client/public", winZip.replace(/^\//, ""));
  const inspected = inspectWinZipArtifact(p);
  if (inspected.ok) ok(`winZip valid (${((inspected.size ?? 0) / 1024 / 1024).toFixed(1)} MB)`);
  else fail(`winZip invalid: ${inspected.reason}`);
  if (isHtmlPayload(p)) fail("winZip is HTML fake file");
  const unzip = spawnSync("unzip", ["-t", p], { encoding: "utf-8" });
  if (unzip.status === 0 && /No errors detected/i.test(unzip.stdout + unzip.stderr)) {
    ok("winZip unzip -t passed");
  } else {
    fail("winZip unzip -t failed");
  }
  if (manifest.winZipSha256) ok("manifest has winZipSha256");
} else if (winZip) {
  ok("winZip uses external URL");
}

if (card.includes("pickWinHref") && card.includes("下载 Windows 客户端") && card.includes("winOffered")) {
  ok("LocalAgentDownloadCard Windows enable logic");
} else fail("LocalAgentDownloadCard missing Windows logic");

if (card.includes("/downloads/") && !card.includes('href="http')) ok("Windows uses /downloads/ relative paths");
else fail("Windows href not relative");

if (!/https?:\/\/localhost[^\s"']*\/downloads/.test(card + mainUi)) ok("no localhost download URL");
else fail("hardcoded localhost download");

if (!/manus\.space/i.test(card + mainUi)) ok("no hardcoded manus.space");
else fail("hardcoded manus.space");

if (!/file:\/\//i.test(card)) ok("no file:// in download card");
else fail("file:// in download card");

if (!/下载 Chrome 插件|browser-extension\.zip|重载插件/.test(mainUi)) ok("Chrome extension not main download");
else fail("Chrome extension main entry");

if (
  card.includes("下载 Mac 客户端") &&
  (card.includes("geo-local-agent-mac") || card.includes("pickMacHref") || card.includes("macZipUrl"))
) {
  ok("Mac download preserved");
} else {
  fail("Mac download missing");
}

if (
  fs.readFileSync(path.join(root, "shared/localAgent.ts"), "utf-8").includes("127.0.0.1:39888") &&
  fs.readFileSync(path.join(root, "client/src/lib/localAgentClient.ts"), "utf-8").includes("/health")
) {
  ok("health check 127.0.0.1:39888/health");
} else fail("health endpoint");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
