#!/usr/bin/env node
/**
 * Agent-Windows-Client-Packaging 验收
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

if (winSetup) {
  const p = path.join(root, "client/public", winSetup.replace(/^\//, ""));
  if (fs.existsSync(p) && fs.statSync(p).size > 1_000_000) ok(`winSetup file exists: ${winSetup}`);
  else fail(`winSetupUrl points to missing file: ${winSetup}`);
}

if (winZip) {
  const p = path.join(root, "client/public", winZip.replace(/^\//, ""));
  if (fs.existsSync(p) && fs.statSync(p).size > 1_000_000) ok(`winZip file exists: ${winZip}`);
  else fail(`winZipUrl points to missing file: ${winZip}`);
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

if (card.includes("下载 Mac 客户端") && card.includes("/downloads/geo-local-agent-mac")) ok("Mac download preserved");
else fail("Mac download missing");

if (
  fs.readFileSync(path.join(root, "shared/localAgent.ts"), "utf-8").includes("127.0.0.1:39888") &&
  fs.readFileSync(path.join(root, "client/src/lib/localAgentClient.ts"), "utf-8").includes("/health")
) {
  ok("health check 127.0.0.1:39888/health");
} else fail("health endpoint");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
