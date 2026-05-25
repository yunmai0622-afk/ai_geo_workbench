#!/usr/bin/env node
/**
 * GEO-V1-F 平台化内容策略静态验收
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf-8");

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

const rules = read("shared/platformContentRules.ts");
const weekly =
  read("client/src/pages/WeeklyContentPage.tsx") + read("client/src/components/PlatformContentStrategyPanel.tsx");
const logic = read("server/geoArticleLogic.ts");
const routers = read("server/routers.ts");

if (rules.includes("PLATFORM_CONTENT_RULES") && rules.includes("zhihu") && rules.includes("netease")) {
  ok("存在 platform content rules");
} else fail("platform rules file");

if (weekly.includes("平台化内容策略") && weekly.includes("platform-content-strategy-panel")) {
  ok("WeeklyContentPage 出现平台化内容策略");
} else fail("weekly panel");

if (weekly.includes("targetPublishPlatform") && routers.includes("targetPublishPlatform")) {
  ok("生成 input 包含 targetPlatform");
} else fail("targetPlatform in input");

if (weekly.includes("contentStrategyType") && weekly.includes("geoEnhancementGoal")) {
  ok("生成 input 包含 contentType 与 geoEnhancementGoal");
} else fail("contentType/geoGoal");

const zh = rules.slice(rules.indexOf('zhihu:'), rules.indexOf('sohu:'));
const so = rules.slice(rules.indexOf('sohu:'), rules.indexOf('toutiao:'));
if (zh !== so && zh.includes("问题回答") && so.includes("媒体稿")) {
  ok("知乎/搜狐规则不同");
} else fail("platform rules differ");

if (logic.includes("getPlatformSpecificOutline") && !logic.includes("所有平台共用同一套")) {
  ok("非所有平台共用同一 prompt 硬编码");
} else fail("shared prompt");

if (!/fake.*publish|mock.*publish/i.test(weekly + routers)) {
  ok("不存在 fake publish");
} else fail("fake publish");

if (!/下载 Chrome 插件|browser-extension\.zip/.test(weekly + logic)) {
  ok("无 Chrome 插件主文案");
} else fail("chrome plugin");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
