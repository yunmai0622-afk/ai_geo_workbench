#!/usr/bin/env node
/**
 * Enterprise-Profile-Simplify-V1 静态验收
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf-8");

const asset = read("client/src/pages/AssetCenter.tsx");
const basic = read("client/src/components/enterpriseProfile/FiveMinuteBasicOnboardingSection.tsx");
const upload = read("client/src/components/enterpriseProfile/ProfileUploadAssistSection.tsx");
const advanced = read("client/src/components/enterpriseProfile/AdvancedMaterialsSection.tsx");
const preview = read("client/src/components/enterpriseProfile/GeoMaterialPreviewSection.tsx");
const publish = read("client/src/components/enterpriseProfile/EnterprisePublishEnvironmentSection.tsx");

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

if (asset.includes("企业 GEO 建档")) ok('page title "企业 GEO 建档"');
else fail("missing page title");

if (basic.includes("5 分钟基础建档") && asset.includes("FiveMinuteBasicOnboardingSection")) {
  ok("5 分钟基础建档 section");
} else fail("missing 5 分钟基础建档");

const publishIdx = asset.indexOf("<EnterprisePublishEnvironmentSection");
const basicIdx = asset.indexOf("<FiveMinuteBasicOnboardingSection");
if (publishIdx >= 0 && basicIdx > publishIdx) ok("publish env before basic onboarding");
else fail("section order wrong");

const p0Count = (basic.match(/testId="p0-field-/g) ?? []).length;
if (p0Count <= 18) ok(`P0 fields count ${p0Count} (<=18)`);
else fail(`too many P0 fields: ${p0Count}`);

if (
  advanced.includes('data-testid="advanced-materials-collapsed"') &&
  !/<details[^>]*\bopen\b/i.test(advanced)
) {
  ok("advanced materials default collapsed");
} else fail("advanced not collapsed");

if (advanced.includes("advanced-fold-cases") && advanced.includes("embedded")) {
  ok("case library nested fold");
} else fail("case library fold");

if (advanced.includes("advanced-fold-faq")) ok("FAQ nested fold");
else fail("FAQ fold");

if (upload.includes("profile-upload-assist") && upload.includes("profile-upload-intake-collapsed")) {
  ok("upload assist compact");
} else fail("upload assist");

if (preview.includes("GEO 建档预览") && preview.includes("geo-onboarding-preview")) {
  ok("GEO preview");
} else fail("GEO preview");

const blob = asset + basic + upload + advanced + publish;
if (!/下载 Chrome 插件|重载插件|browser-extension\.zip/.test(blob)) ok("no Chrome plugin copy");
else fail("Chrome plugin copy");

if (!/profileId|localAgentId|rawJson|schema|provider|adapter/.test(asset + basic)) ok("no engineering fields in main UI");
else fail("engineering fields in UI");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
