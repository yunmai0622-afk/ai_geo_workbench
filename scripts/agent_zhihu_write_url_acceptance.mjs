#!/usr/bin/env node
/**
 * Agent-Zhihu-WriteUrl-Final-Fix：知乎发布页固定 zhuanlan.zhihu.com/write
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = "https://zhuanlan.zhihu.com/write";

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf-8");
}

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

const zhihu = read("local-agent/src/agent/platforms/zhihuPublisher.ts");
const appJs = read("local-agent/src/renderer/app.js");

if (zhihu.includes(TARGET)) ok("zhihuPublisher contains zhuanlan write URL");
else fail("zhihuPublisher missing zhuanlan write URL");

const candidatesBlock = zhihu.match(/ZHIHU_WRITE_URL_CANDIDATES\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1] ?? "";
const creatorPriority =
  /goto\s*\(\s*["']https:\/\/www\.zhihu\.com\/creator/.test(zhihu) ||
  candidatesBlock.includes("www.zhihu.com/creator");
if (!creatorPriority) ok("zhihuPublisher does not prioritize www.zhihu.com/creator");
else fail("zhihuPublisher still prioritizes www.zhihu.com/creator");

const wwwWritePriority =
  /goto\s*\(\s*["']https:\/\/www\.zhihu\.com\/write/.test(zhihu) ||
  candidatesBlock.includes("www.zhihu.com/write");
if (!wwwWritePriority) ok("zhihuPublisher does not prioritize www.zhihu.com/write");
else fail("zhihuPublisher still prioritizes www.zhihu.com/write");

if (zhihu.includes("targetUrl") && zhihu.includes("actualUrl")) {
  ok("logs include targetUrl and actualUrl");
} else fail("missing targetUrl / actualUrl in logs");

if (!/open_write_success[\s\S]{0,200}404/.test(zhihu) && !/status:\s*["']ok["'][\s\S]{0,120}write_page_404/.test(zhihu)) {
  ok("no logic marking 404 as success");
} else fail("possible 404 marked as success");

if (zhihu.includes("manual_required")) ok("manual_required fallback exists");
else fail("manual_required fallback missing");

const fakePatterns = [
  /fake\s+draft_saved/i,
  /fake\s+completed/i,
  /draft_saved:\s*true\s*\/\/\s*fake/i,
  /completed:\s*true\s*\/\/\s*fake/i,
];
if (!fakePatterns.some(p => p.test(zhihu))) ok("no fake draft_saved / completed");
else fail("fake draft_saved or completed detected");

if (appJs.includes("已打开知乎发布页")) ok("client success message");
else fail("client missing success message");

if (appJs.includes("知乎发布页打开失败")) ok("client failure message");
else fail("client missing failure message");

if (appJs.includes(TARGET) || appJs.includes("zhuanlan.zhihu.com/write")) {
  ok("client references zhuanlan write URL");
} else fail("client does not reference zhuanlan write URL");

console.log(`\n--- acceptance: ${passed} passed, ${failed} failed ---\n`);

if (failed > 0) process.exit(1);

console.log("--- local-agent typecheck ---");
const tc = spawnSync("npm", ["run", "typecheck"], {
  cwd: path.join(root, "local-agent"),
  stdio: "inherit",
});
if (tc.status !== 0) process.exit(tc.status ?? 1);

console.log("\n--- local-agent build ---");
const bd = spawnSync("npm", ["run", "build"], {
  cwd: path.join(root, "local-agent"),
  stdio: "inherit",
});
if (bd.status !== 0) process.exit(bd.status ?? 1);

console.log("\n=== agent_zhihu_write_url_acceptance PASSED ===\n");
