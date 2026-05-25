#!/usr/bin/env node
/**
 * Enterprise-Profile-UX-Redesign 静态验收
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf-8");

const asset = read("client/src/pages/AssetCenter.tsx");
const publishEnv = read("client/src/components/enterpriseProfile/EnterprisePublishEnvironmentSection.tsx");
const caseLib = read("client/src/components/enterpriseProfile/CustomerCaseLibrarySection.tsx");
const binding = read("client/src/components/PlatformAccountBindingSection.tsx");

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

if (publishEnv.indexOf("LocalAgentDownloadCard") < publishEnv.indexOf("PlatformAccountBindingSection")) {
  ok("LocalAgentDownloadCard before PlatformAccountBindingSection in publish env");
} else fail("download card order in EnterprisePublishEnvironmentSection");

if (asset.indexOf("EnterprisePublishEnvironmentSection") < asset.indexOf('id="profile-basic"')) {
  ok("client download section before enterprise basic info");
} else fail("publish env not before profile-basic");

if (caseLib.includes("CustomerCaseLibrarySection") || asset.includes("CustomerCaseLibrarySection")) {
  ok("case library component wired");
} else fail("missing CustomerCaseLibrarySection");

if (!asset.includes("保存本条案例") && !asset.includes("案例 1</p>")) {
  ok("no expanded inline case mega-forms in AssetCenter");
} else fail("legacy expanded case forms still in AssetCenter");

if (!/下载 Chrome 插件|browser-extension\.zip|重载插件/.test(asset + publishEnv + binding)) {
  ok("no Chrome extension main copy");
} else fail("Chrome extension copy found");

if (asset.includes("GeoMaterialPreviewSection") && read("client/src/components/enterpriseProfile/GeoMaterialPreviewSection.tsx").includes("geo-material-preview")) {
  ok("GEO material preview present");
} else fail("missing GEO preview");

if (asset.includes('data-testid="enterprise-profile-step-nav"')) {
  ok("step navigation present");
} else fail("missing step nav");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
