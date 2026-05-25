#!/usr/bin/env node
/**
 * Enterprise-Account-Matrix-Redesign 静态验收
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf-8");

const shared = read("shared/platformAccountVerify.ts");
const hook = read("client/src/components/platformAccounts/usePlatformAccountBinding.ts");
const matrix = read("client/src/components/platformAccounts/PlatformAccountMatrix.tsx");
const binding = read("client/src/components/PlatformAccountBindingSection.tsx");
const sidebar = read("client/src/components/platformAccounts/AccountGroupSidebar.tsx");
const tabs = read("client/src/components/platformAccounts/PlatformTabs.tsx");
const table = read("client/src/components/platformAccounts/PlatformAccountTable.tsx");
const tech = read("client/src/components/platformAccounts/PlatformAccountTechnicalDialog.tsx");

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

if (shared.includes("netease")) ok("platform list includes netease");
else fail("missing netease in shared");

if (hook.includes("selectedPlatform")) ok("selectedPlatform state");
else fail("missing selectedPlatform");

if (sidebar.includes("platform-account-group-sidebar")) ok("account group sidebar");
else fail("missing account group sidebar");

if (tabs.includes("platform-account-tabs")) ok("platform tabs");
else fail("missing platform tabs");

if (table.includes("platform-account-table")) ok("platform account table");
else fail("missing platform account table");

if (!binding.includes("BINDING_PUBLISH_PLATFORMS.map") && !matrix.includes("BINDING_PUBLISH_PLATFORMS.map")) {
  ok("no legacy vertical map of all platforms");
} else fail("legacy vertical platform map still present");

if (!/下载 Chrome 插件|重载插件|browser-extension\.zip/.test(matrix + binding + hook)) {
  ok("no Chrome extension copy");
} else fail("Chrome extension copy found");

if (!table.includes("localAgentId") && !table.includes("profileId")) {
  ok("main table hides profileId/localAgentId");
} else fail("main table exposes technical ids");

if (tech.includes("技术信息") && table.includes("platform-account-technical")) ok("technical info entry");
else fail("missing technical info entry");

const cardIdx = matrix.indexOf("LocalAgentDownloadCard");
const matrixIdx = matrix.indexOf("platform-account-matrix");
if (cardIdx >= 0 && matrixIdx > cardIdx) ok("LocalAgentDownloadCard before PlatformAccountMatrix");
else fail("download card order in matrix");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
