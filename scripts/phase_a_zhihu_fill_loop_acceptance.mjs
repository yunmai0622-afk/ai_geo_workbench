#!/usr/bin/env node
/**
 * Phase A：知乎 Local Agent 真实填稿闭环（工程验收 + 可选实机）
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
const failures = [];
const passes = [];

function pass(m) {
  passes.push(m);
  console.log("[PASS]", m);
}
function fail(m) {
  failures.push(m);
  console.error("[FAIL]", m);
}

function mustInclude(file, needles) {
  const text = fs.readFileSync(path.join(root, file), "utf-8");
  for (const n of needles) {
    if (!text.includes(n)) fail(`${file} 缺少 ${n}`);
    else pass(`${file}: ${n}`);
  }
}

if (!fs.existsSync(artifacts)) fs.mkdirSync(artifacts, { recursive: true });

mustInclude("local-agent/src/agent/platforms/zhihuPublisher.ts", [
  "waitForWriteEditor",
  "hasWriteEditor",
  "write_page_not_found",
]);
mustInclude("local-agent/src/agent/platforms/basePublisher.ts", ["fill_content", "manual_required"]);

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

let realMachine = { ok: false, detail: "未执行" };
if (process.env.PHASE_A_SKIP_REALRUN !== "1") {
  try {
    execSync("node scripts/session_reuse_smoke.mjs", {
      cwd: path.join(root, "local-agent"),
      stdio: "inherit",
      env: { ...process.env },
    });
    realMachine = { ok: true, detail: "session_reuse_smoke exit 0" };
    pass("实机 session_reuse_smoke");
  } catch (e) {
    const code = e.status ?? 1;
    realMachine = {
      ok: false,
      detail: code === 3 ? "需本机登录知乎（login_required / 无编辑器）" : `exit ${code}`,
    };
    console.warn("[WARN] 实机未通过:", realMachine.detail);
  }
}

const report = {
  phase: "Phase-A-Zhihu-Fill-Loop",
  finishedAt: new Date().toISOString(),
  engineeringPass: failures.length === 0,
  realMachine,
  passes: passes.length,
  failures: failures.length,
};
fs.writeFileSync(path.join(artifacts, "phase-a-report.json"), JSON.stringify(report, null, 2));

console.log("\n=== Phase A 验收 ===");
console.log(`工程项: ${passes.length} pass / ${failures.length} fail`);
console.log(`实机: ${realMachine.ok ? "通过" : realMachine.detail}`);

if (failures.length > 0) process.exit(1);
process.exit(0);
