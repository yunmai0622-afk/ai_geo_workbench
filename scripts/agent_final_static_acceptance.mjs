#!/usr/bin/env node
/**
 * Agent-Series-Final 静态验收（不 mock 平台发布成功）
 * 用法：node scripts/agent_final_static_acceptance.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf-8");

const failures = [];
const passes = [];

function pass(msg) {
  passes.push(msg);
}
function fail(msg) {
  failures.push(msg);
}

function mustInclude(file, needles, label) {
  const text = read(file);
  for (const n of needles) {
    if (!text.includes(n)) fail(`${label}: ${file} 缺少「${n}」`);
    else pass(`${label}: ${n}`);
  }
}

function mustNotMatch(file, pattern, label) {
  const text = read(file);
  if (pattern.test(text)) fail(`${label}: ${file} 命中禁止模式 ${pattern}`);
  else pass(`${label}: 未命中 ${pattern}`);
}

// Agent-0
if (!fs.existsSync(path.join(root, "local-agent/package.json"))) fail("缺少 local-agent/");
else pass("local-agent 目录存在");
mustInclude("local-agent/src/agent/platforms/browserSession.ts", ["launchPersistentContext"], "Agent-0");
mustInclude("local-agent/src/agent/storage.ts", ["profileId", "sessionStatus"], "Agent-0 storage");
mustNotMatch("local-agent/src/agent/storage.ts", /password|cookie/i, "Agent-0 storage");

// Agent-1
mustInclude("local-agent/src/agent/localServer.ts", ["/health", "39888", "127.0.0.1"], "Agent-1");
mustInclude("client/src/components/PlatformAccountBindingSection.tsx", [
  "未检测到本地发布客户端",
  "bindLocalAgentAccount",
], "Agent-1 Web");
mustNotMatch("server/projectPlatformAccounts.ts", /profilePath/, "Agent-1 server DB");

// Agent-2
mustInclude("server/publishTasksRouter.ts", [
  "pending_agent",
  "localProfileId",
  "publishBlockedNoLocalProfileMessage",
], "Agent-2");
mustInclude("server/agentRouter.ts", ["pollTasks", "claimTask", "reportTaskResult"], "Agent-2");
mustInclude("server/agentPublishTasks.ts", ["draft_saved 必须提供", "AGENT_POLL_PLATFORMS"], "Agent-2");
mustInclude("local-agent/src/agent/publishWorker.ts", ["publishWithPlatform"], "Agent-2 agent");

// Agent-3
mustInclude("local-agent/src/agent/platforms/publisherFactory.ts", [
  "zhihuPublisher",
  "sohuPublisher",
  "baijiahaoPublisher",
  "toutiaoPublisher",
], "Agent-3");
mustInclude("local-agent/src/agent/platforms/basePublisher.ts", [
  "open_home",
  "detect_account",
  "open_write",
  "fill_title",
  "fill_content",
  "account_mismatch",
], "Agent-3 steps");

// Agent-4
mustInclude("local-agent/src/renderer/index.html", ["总览", "账号环境", "发布任务", "执行日志", "设置"], "Agent-4 UI");
mustInclude("local-agent/src/agent/taskLogStore.ts", ["task-${taskId}.json"], "Agent-4 logs");
mustInclude("local-agent/src/agent/diagnostics.ts", ["REDACTED", "不包含 Cookie"], "Agent-4 diag");
mustInclude("local-agent/README.md", ["不保存平台密码", "导出诊断包"], "Agent-4 README");
const pkg = JSON.parse(read("local-agent/package.json"));
for (const s of ["dev", "typecheck", "build"]) {
  if (!pkg.scripts[s]) fail(`local-agent 缺少 script: ${s}`);
  else pass(`script ${s}`);
}

// Migrations
for (const m of ["0029_local_agent_account_binding.sql", "0026_agent_publish_tasks.sql"]) {
  if (!fs.existsSync(path.join(root, "drizzle", m))) fail(`缺少 migration ${m}`);
  else pass(`migration ${m}`);
}
mustInclude("drizzle/meta/_journal.json", ["0029_local_agent_account_binding", "0026_agent_publish_tasks"], "journal");

// Artifacts checklist files
const artifactChecklists = [
  "artifacts/AGENT_SERIES_SCREENSHOTS.md",
];
for (const a of artifactChecklists) {
  if (!fs.existsSync(path.join(root, a))) fail(`缺少 ${a}`);
  else pass(`存在 ${a}`);
}

console.log("\n=== Agent-Series-Final 静态验收 ===\n");
console.log(`通过项: ${passes.length}`);
console.log(`失败项: ${failures.length}`);
if (failures.length) {
  console.log("\n失败清单:");
  failures.forEach((f) => console.log("  ✗", f));
  process.exit(1);
}
console.log("\n静态验收通过。请在本机补跑：pnpm check/test/build、local-agent dev、手工截图。\n");
