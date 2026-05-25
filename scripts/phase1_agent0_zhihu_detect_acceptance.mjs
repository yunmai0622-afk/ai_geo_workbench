#!/usr/bin/env node
/**
 * Phase 1 闸门验收：Agent-0 知乎账号检测（单进程，与 Electron 客户端同逻辑）
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agentRoot = path.join(root, "local-agent");
const artifacts = path.join(root, "artifacts");
const PROFILE = process.env.REALRUN_ZHIHU_PROFILE_ID || "zhihu_1779680573502";
const LOGIN_WAIT = Math.max(0, Number(process.env.REALRUN_LOGIN_WAIT_SEC ?? "0") || 0);

const require = createRequire(import.meta.url);
const report = {
  phase: "Phase-1-Agent-0-Zhihu-Detect-Fix",
  startedAt: new Date().toISOString(),
  checks: [],
};

function pass(name, detail) {
  report.checks.push({ name, ok: true, detail });
  console.log(`[PASS] ${name}`, detail ?? "");
}
function fail(name, detail) {
  report.checks.push({ name, ok: false, detail });
  console.error(`[FAIL] ${name}`, detail ?? "");
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: "inherit", shell: true });
    p.on("error", reject);
    p.on("close", code => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  if (!fs.existsSync(artifacts)) fs.mkdirSync(artifacts, { recursive: true });

  try {
    await run("node", ["scripts/ensure-electron.mjs"], agentRoot);
    pass("ensure-electron");
  } catch (e) {
    fail("ensure-electron", e.message);
  }

  try {
    await run("npm", ["run", "typecheck"], agentRoot);
    pass("typecheck");
  } catch (e) {
    fail("typecheck", e.message);
    return finish(false);
  }

  try {
    await run("npm", ["run", "build"], agentRoot);
    pass("build");
  } catch (e) {
    fail("build", e.message);
    return finish(false);
  }

  const zhihu = require(path.join(agentRoot, "dist/agent/platforms/zhihuPublisher.js"));
  const { closeContext } = require(path.join(agentRoot, "dist/agent/platforms/browserSession.js"));
  const { readAccounts } = require(path.join(agentRoot, "dist/agent/storage.js"));

  await closeContext(PROFILE);
  const acc = readAccounts().accounts.find(a => a.profileId === PROFILE);
  if (!acc) {
    fail("profile_exists", PROFILE);
    return finish(false);
  }
  pass("profile_path_consistent", acc.profilePath);

  const open = await zhihu.zhihuPublisher.openLoginHome(PROFILE);
  if (!open.ok) {
    fail("open_login", open.message);
    return finish(false);
  }
  pass("open_login", open.message);

  if (LOGIN_WAIT > 0) {
    console.log(`[wait] 手动登录等待 ${LOGIN_WAIT}s ...`);
    await sleep(LOGIN_WAIT * 1000);
  }

  const detect = await zhihu.zhihuPublisher.detectAccountSession(PROFILE);
  report.detect = detect;
  fs.writeFileSync(path.join(artifacts, "phase1-detect-result.json"), JSON.stringify(detect, null, 2));

  const accAfter = readAccounts().accounts.find(a => a.profileId === PROFILE);
  report.accountAfter = accAfter;

  if (detect.ok && detect.accountName) {
    pass("detect_account", detect.accountName);
    if (accAfter?.sessionStatus === "active") pass("session_active", accAfter.sessionStatus);
    else fail("session_active", accAfter?.sessionStatus);
    return finish(true);
  }

  fail("detect_account", `${detect.errorType}: ${detect.message}`);
  if (detect.errorType === "login_required") {
    report.blocker = "需在本机 Playwright 窗口完成知乎登录后重跑（REALRUN_LOGIN_WAIT_SEC=120）";
  }
  return finish(false);
}

function finish(ok) {
  report.passed = ok;
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(artifacts, "phase1-report.json"), JSON.stringify(report, null, 2));
  console.log("\n=== Phase 1 Report ===\n", JSON.stringify(report, null, 2));
  process.exit(ok ? 0 : 2);
}

main().catch(e => {
  fail("exception", e.message);
  finish(false);
});
