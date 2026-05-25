#!/usr/bin/env node
/**
 * Agent-Mac-Dmg-Corruption-Fix：Mac zip 优先下载静态验收
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

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
  const size = fs.statSync(macZip).size;
  if (size > MIN_ZIP_BYTES) ok(`zip size ${(size / 1024 / 1024).toFixed(1)}MB > 50MB`);
  else fail(`zip too small: ${size} bytes`);
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

const pickFn = card.match(/function pickMacHref[\s\S]*?^}/m)?.[0] ?? "";
if (pickFn.includes("macZipUrl") && pickFn.includes("macDmgUrl")) {
  const zipBranch = pickFn.indexOf("if (zip?.startsWith");
  const dmgBranch = pickFn.indexOf("if (dmg?.startsWith");
  if (zipBranch >= 0 && dmgBranch >= 0 && zipBranch < dmgBranch) {
    ok("LocalAgentDownloadCard prefers macZipUrl over macDmgUrl");
  } else {
    fail("pickMacHref: zip branch must precede dmg branch");
  }
} else {
  fail("card missing zip-first pickMacHref logic");
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
