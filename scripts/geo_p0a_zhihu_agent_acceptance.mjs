#!/usr/bin/env node
/**
 * GEO-P0-A：知乎 Local Agent 填稿闭环 — 静态工程验收
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
const failures = [];
const passes = [];

function pass(msg) {
  passes.push(msg);
  console.log("[PASS]", msg);
}
function fail(msg) {
  failures.push(msg);
  console.error("[FAIL]", msg);
}

function mustInclude(rel, needles) {
  const text = fs.readFileSync(path.join(root, rel), "utf-8");
  for (const n of needles) {
    if (!text.includes(n)) fail(`${rel} 缺少「${n}」`);
    else pass(`${rel}: ${n}`);
  }
}

function mustNotMatch(rel, pattern, label) {
  const text = fs.readFileSync(path.join(root, rel), "utf-8");
  if (pattern.test(text)) fail(`${label}: ${rel} 命中禁止模式`);
  else pass(`${label}: ${rel} 未命中禁止上传凭证`);
}

if (!fs.existsSync(path.join(root, "local-agent"))) fail("缺少 local-agent 目录");
else pass("local-agent 目录存在");

mustInclude("local-agent/src/agent/platforms/zhihuPublisher.ts", [
  "zhihuPublisher",
  "fill_title",
  "fill_content",
  "manual_required",
  "write_page_not_found",
  "override async publish",
]);
mustInclude("local-agent/src/agent/publishWorker.ts", ["report_result", "reportPublishOutcome"]);
mustInclude("local-agent/src/agent/platforms/basePublisher.ts", ["draft_saved", "completed", "manual_required"]);
mustInclude("server/agentPublishTasks.ts", [
  "draft_saved 必须提供",
  "completed 状态必须提供 publicUrl",
]);
mustInclude("shared/publishTaskErrors.ts", ["manual_required", "需人工确认"]);

const zhihu = fs.readFileSync(path.join(root, "local-agent/src/agent/platforms/zhihuPublisher.ts"), "utf-8");
if (/status:\s*["']draft_saved["']/.test(zhihu) && !/save\.saved/.test(zhihu)) {
  fail("zhihuPublisher 可能存在无证据 draft_saved");
} else {
  pass("manual_required 与 draft_saved 分支分离");
}

mustNotMatch("local-agent/src/agent/storage.ts", /password|upload.*cookie|cookie.*upload/i, "storage");
mustNotMatch("server/projectPlatformAccounts.ts", /profilePath|password|cookie/i, "server bind");

try {
  execSync("npm run typecheck", { cwd: path.join(root, "local-agent"), stdio: "inherit" });
  pass("local-agent typecheck");
} catch {
  fail("local-agent typecheck");
}

try {
  execSync("npm run build", { cwd: path.join(root, "local-agent"), stdio: "inherit" });
  pass("local-agent build");
} catch {
  fail("local-agent build");
}

try {
  execSync("pnpm check", { cwd: root, stdio: "inherit" });
  pass("pnpm check");
} catch {
  fail("pnpm check");
}

try {
  execSync("pnpm exec vitest run server/v12PhaseAZhihuFillLoop.test.ts", { cwd: root, stdio: "inherit" });
  pass("vitest Phase A");
} catch {
  fail("vitest Phase A");
}

const screenshotChecklist = [
  "geo-p0a-client-account-active.png",
  "geo-p0a-zhihu-write-page.png",
  "geo-p0a-title-filled.png",
  "geo-p0a-content-filled.png",
  "geo-p0a-web-manual-required.png",
  "geo-p0a-task-log.json",
];
const missingShots = screenshotChecklist.filter(f => !fs.existsSync(path.join(artifacts, f)));

const report = {
  phase: "GEO-P0-A",
  finishedAt: new Date().toISOString(),
  engineeringPass: failures.length === 0,
  passes: passes.length,
  failures: failures.length,
  missingScreenshots: missingShots,
  realMachineNote:
    missingShots.length > 0
      ? "实机截图与 task-log 需本机登录知乎后执行 local-agent 填稿任务生成"
      : "实机截图已齐",
  allowNextPhase: failures.length === 0,
};
if (!fs.existsSync(artifacts)) fs.mkdirSync(artifacts, { recursive: true });
fs.writeFileSync(path.join(artifacts, "geo-p0a-acceptance-report.json"), JSON.stringify(report, null, 2));

console.log("\n=== GEO-P0-A 验收 ===");
console.log(`工程: ${failures.length === 0 ? "通过" : "未通过"} (${passes.length} pass / ${failures.length} fail)`);
if (missingShots.length) console.log("缺失截图/日志:", missingShots.join(", "));

process.exit(failures.length > 0 ? 1 : 0);
