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
const localAgentPkg = JSON.parse(
  fs.readFileSync(path.join(root, "local-agent/package.json"), "utf-8"),
);
const expectedVersion = localAgentPkg.version?.trim() ?? "";
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
const DEFAULT_RELATIVE_ZIP = "/downloads/geo-local-agent-mac.zip";
const macZipExternal = manifest.macZipExternal === true;

if (!expectedVersion) fail("local-agent/package.json missing version");
else ok(`local-agent version ${expectedVersion}`);

if (manifest.version === expectedVersion) ok(`manifest.version matches local-agent (${expectedVersion})`);
else fail(`manifest.version=${manifest.version} expected ${expectedVersion}`);

if (String(manifest.macZipUrl ?? "").includes(`geo-local-agent-v${expectedVersion}`)) {
  ok(`manifest.macZipUrl points to v${expectedVersion}`);
} else if (manifest.macZipUrl === DEFAULT_RELATIVE_ZIP) {
  ok("manifest.macZipUrl uses local relative path (dev)");
} else {
  fail(`manifest.macZipUrl does not point to v${expectedVersion}: ${manifest.macZipUrl}`);
}

if (macZipExternal) {
  ok("manifest.macZipExternal=true（外链 Release，本地 zip 可选）");
} else if (fs.existsSync(macZip)) {
  ok("geo-local-agent-mac.zip exists");
} else {
  fail("missing geo-local-agent-mac.zip");
}

if (fs.existsSync(macZip)) {
  const size = fs.statSync(macZip).size;
  if (size > MIN_ZIP_BYTES) ok(`zip size ${(size / 1024 / 1024).toFixed(1)}MB > 50MB`);
  else fail(`zip too small: ${size} bytes`);

  const unzip = spawnSync("unzip", ["-t", macZip], { encoding: "utf-8" });
  if (unzip.status === 0 && /No errors detected/i.test(unzip.stdout + unzip.stderr)) {
    ok("unzip -t passed");
  } else {
    fail(`unzip -t failed: ${unzip.stderr || unzip.stdout}`);
  }

  if (macZipExternal && typeof manifest.macZipSha256 === "string") {
    const localSha = spawnSync("shasum", ["-a", "256", macZip], { encoding: "utf-8" });
    const hash = localSha.stdout.trim().split(/\s+/)[0]?.toLowerCase();
    if (hash && hash !== manifest.macZipSha256.toLowerCase()) {
      ok("local zip sha differs from manifest (external Release mode; server redirects to manifest URL)");
    } else if (hash === manifest.macZipSha256.toLowerCase()) {
      ok("local zip sha matches manifest");
    }
  }
} else if (!macZipExternal) {
  fail("missing geo-local-agent-mac.zip");
}

if (manifest.macZipUrl === DEFAULT_RELATIVE_ZIP) {
  ok("manifest.macZipUrl -> /downloads/geo-local-agent-mac.zip (local dev)");
} else if (
  typeof manifest.macZipUrl === "string" &&
  /^https?:\/\/.+\.zip(\?|$)/i.test(manifest.macZipUrl)
) {
  ok(`manifest.macZipUrl -> external HTTPS zip (${manifest.macZipUrl.slice(0, 72)}...)`);
} else {
  fail(`manifest.macZipUrl unexpected: ${manifest.macZipUrl}`);
}

if (manifest.macZipUrl === DEFAULT_RELATIVE_ZIP) {
  ok("manifest macZipUrl is local relative path");
} else if (/^https?:\/\/.+\.zip/i.test(manifest.macZipUrl ?? "")) {
  ok("manifest macZipUrl is HTTPS release URL");
}

const indexTs = fs.readFileSync(path.join(root, "server/_core/index.ts"), "utf-8");
if (indexTs.includes("readMacZipRedirectUrl")) {
  ok("server redirects /downloads/geo-local-agent-mac.zip via manifest");
} else {
  fail("server missing manifest-driven mac zip redirect");
}

if (typeof manifest.macZipSha256 === "string" && /^[a-f0-9]{64}$/i.test(manifest.macZipSha256)) {
  ok("manifest.macZipSha256 present");
} else if (manifest.macZipUrl === DEFAULT_RELATIVE_ZIP && fs.existsSync(macZip)) {
  fail("local relative macZipUrl requires manifest.macZipSha256");
} else if (/^https?:\/\//i.test(manifest.macZipUrl ?? "")) {
  fail("HTTPS macZipUrl requires manifest.macZipSha256");
}

if (manifest.macDmgUrl == null) ok("manifest.macDmgUrl is null (dmg hidden)");
else fail(`manifest.macDmgUrl should be null, got ${manifest.macDmgUrl}`);

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

const copyScript = fs.readFileSync(path.join(root, "scripts/copy_local_agent_download.mjs"), "utf-8");
if (copyScript.includes("AGENT_MAC_ZIP_URL") && copyScript.includes("macDmgUrl: null")) {
  ok("copy_local_agent_download supports AGENT_MAC_ZIP_URL and macDmgUrl null");
} else {
  fail("copy script missing AGENT_MAC_ZIP_URL or macDmgUrl null");
}
if (
  copyScript.includes("shouldPreserveExternalMacManifest") &&
  copyScript.includes("preserveExternalMac") &&
  copyScript.includes("delete safeExtras.macZipSha256")
) {
  ok("copy_local_agent_download preserves external Release manifest hash on prebuild");
} else {
  fail("copy script must preserve HTTPS external macZipSha256 during prebuild");
}

if (card.includes("下载 Mac 客户端（推荐）")) ok('Mac button copy contains "推荐"');
else fail('Mac button missing "下载 Mac 客户端（推荐）"');

if (!/优先 dmg|\.dmg 推荐/i.test(card)) ok("card does not default to dmg recommendation");
else fail("card still recommends dmg by default");

if (!/https?:\/\/localhost[^\s"']*\/downloads/.test(card)) ok("no hardcoded localhost download URL");
else fail("hardcoded localhost download URL");

const manifestText = fs.readFileSync(manifestPath, "utf-8");
if (!/manus\.space/i.test(card)) ok("no hardcoded manus.space in download card");
else fail("hardcoded manus.space in download card");
if (/geoWebBaseUrl/i.test(manifestText) && /manus\.space/i.test(manifestText)) {
  ok("manifest geoWebBaseUrl may reference production host");
} else if (!/manus\.space/i.test(manifestText)) {
  ok("manifest has no hardcoded manus.space");
} else {
  fail("manifest references manus.space without geoWebBaseUrl field");
}

if (!/file:\/\//i.test(card)) ok("no file:// download links");
else fail("file:// in card");

if (!/Chrome\s*插件|重载插件|下载插件|插件版本/.test(mainUi)) ok("no Chrome extension main copy");
else fail("Chrome extension main copy found");

if (!mainUi.includes("browser-extension.zip")) ok("browser-extension.zip not main download");
else fail("browser-extension.zip referenced as main download");

console.log(`\n--- acceptance: ${passed} passed, ${failed} failed ---\n`);
if (failed > 0) process.exit(1);
console.log("=== agent_mac_download_package_acceptance PASSED ===\n");
