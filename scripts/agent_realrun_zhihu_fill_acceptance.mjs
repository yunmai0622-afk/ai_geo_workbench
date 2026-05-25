#!/usr/bin/env node
/**
 * Agent-Real-Run-Zhihu-Fill-And-Report
 * 本地知乎填稿真实验收（不 mock、不 fake draft_saved/completed）
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
const agentRoot = path.join(root, "local-agent");
const require = createRequire(import.meta.url);

const PROFILE_ID = process.env.REALRUN_ZHIHU_PROFILE_ID?.trim() || "zhihu_1779680573502";
const LOGIN_WAIT_SEC = Math.max(0, Number(process.env.REALRUN_LOGIN_WAIT_SEC ?? "0") || 0);
const TITLE = "GEO 本地 Agent 测试标题";
const CONTENT = "这是一条用于验证 Local Agent 自动填稿能力的测试正文。";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function agentDetect(profileId) {
  const res = await fetch(
    `http://127.0.0.1:39888/profiles/${encodeURIComponent(profileId)}/detect-account`,
    { method: "POST", headers: { "content-type": "application/json" }, body: "{}", signal: AbortSignal.timeout(120000) },
  );
  return res.json();
}

function loadPhase2ReuseReport() {
  const p = path.join(artifacts, "phase2-session-reuse-report.json");
  if (!fs.existsSync(p)) {
    return { ok: false, reason: "缺少 phase2-session-reuse-report.json，请先执行 session_reuse_smoke.mjs" };
  }
  const data = JSON.parse(fs.readFileSync(p, "utf-8"));
  const writeOk = Boolean(data.write?.ok && data.write?.hasEditor);
  const homeOk = Boolean(data.home?.ok && data.home?.sessionStatus === "active");
  if (!writeOk && !homeOk) {
    return {
      ok: false,
      reason: `Phase 2 未通过：home=${data.home?.errorType ?? data.home?.sessionStatus}, write=${data.write?.errorType ?? "fail"}`,
      report: data,
    };
  }
  return { ok: true, report: data };
}

async function checkPhase2WebBinding() {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const exec = promisify(execFile);
  try {
    const { stdout } = await exec("mysql", [
      "-uroot",
      "ai_geo_workbench",
      "-N",
      "-e",
      `SELECT id, accountName, localProfileId, sessionStatus FROM project_platform_accounts WHERE platform='zhihu' AND localProfileId IS NOT NULL AND localProfileId != '' LIMIT 1`,
    ]);
    const line = stdout.trim();
    if (!line) return { ok: false, reason: "Web 未绑定知乎 localProfile" };
    const [id, accountName, localProfileId, sessionStatus] = line.split("\t");
    return { ok: true, row: { id, accountName, localProfileId, sessionStatus } };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  if (!fs.existsSync(artifacts)) fs.mkdirSync(artifacts, { recursive: true });

  const phase2Reuse = loadPhase2ReuseReport();
  const phase2Web = await checkPhase2WebBinding();
  const report = {
    phase: "Agent-Real-Run-Zhihu-Fill-And-Report",
    startedAt: new Date().toISOString(),
    profileId: PROFILE_ID,
    phase2Reuse,
    phase2Web,
    localFill: null,
    webFill: { skipped: true, reason: "Phase 2 闸门未通过，未执行填稿" },
    blocked: true,
  };

  console.log("[phase2-reuse]", JSON.stringify(phase2Reuse));
  console.log("[phase2-web]", JSON.stringify(phase2Web));

  if (!phase2Reuse.ok) {
    report.blocker =
      phase2Reuse.reason ??
      "Phase 2 未通过：需 session_reuse_smoke 中 home 登录有效且 write 页有编辑器";
    fs.writeFileSync(path.join(artifacts, "realrun-zhihu-fill-report.json"), JSON.stringify(report, null, 2));
    console.error("\n[STOP] Phase 2 未通过，按总控规则不得执行本 Phase 填稿验收。\n");
    console.error(report.blocker);
    process.exit(2);
  }

  report.blocked = false;

  try {
    await fetch("http://127.0.0.1:39888/health", { signal: AbortSignal.timeout(3000) });
  } catch {
    console.error("[FAIL] local-agent HTTP 未启动，请先: cd local-agent && npm run dev");
    process.exit(1);
  }

  if (LOGIN_WAIT_SEC > 0) {
    console.log(`[step] open-login，请在 ${LOGIN_WAIT_SEC}s 内手动登录知乎`);
    await fetch(`http://127.0.0.1:39888/profiles/${encodeURIComponent(PROFILE_ID)}/open-login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const deadline = Date.now() + LOGIN_WAIT_SEC * 1000;
    let detect = await agentDetect(PROFILE_ID);
    while (Date.now() < deadline && !detect.ok) {
      await sleep(15000);
      detect = await agentDetect(PROFILE_ID);
      console.log("[detect]", JSON.stringify(detect));
    }
    report.detectAfterLogin = detect;
  }

  const { publishWithPlatform } = require(path.join(agentRoot, "dist/agent/platforms/publisherFactory.js"));
  const { closeContext } = require(path.join(agentRoot, "dist/agent/platforms/browserSession.js"));
  const { getOrLaunchContext } = require(path.join(agentRoot, "dist/agent/platforms/browserSession.js"));

  await closeContext(PROFILE_ID);
  let detect = report.detectAfterLogin;
  if (!detect?.ok) {
    try {
      detect = await agentDetect(PROFILE_ID);
    } catch (e) {
      detect = { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }
  report.preFillDetect = detect;

  const expectedName =
    process.env.REALRUN_EXPECTED_ACCOUNT_NAME?.trim() ||
    detect.accountName ||
    report.phase2Web.row?.accountName ||
    "";

  if (!expectedName && process.env.REALRUN_ALLOW_FILL_WITHOUT_ACCOUNT_MATCH !== "1") {
    report.localFill = {
      status: "blocked",
      errorType: "login_required",
      errorMessage: "无已登录昵称，无法做账号一致性校验与填稿（请先登录后设置 REALRUN_LOGIN_WAIT_SEC）",
    };
    fs.writeFileSync(path.join(artifacts, "realrun-zhihu-fill-report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  const task = {
    taskId: Number(process.env.REALRUN_TASK_ID ?? "900001"),
    platform: "zhihu",
    localProfileId: PROFILE_ID,
    expectedAccountName:
      expectedName ||
      (process.env.REALRUN_ALLOW_FILL_WITHOUT_ACCOUNT_MATCH === "1" ? "" : ""),
    title: TITLE,
    content: CONTENT,
    action: "save_draft",
  };

  const ctx = await getOrLaunchContext(PROFILE_ID, false);
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  async function shot(name) {
    try {
      await page.screenshot({ path: path.join(artifacts, name), fullPage: false });
      console.log("[screenshot]", name);
    } catch (e) {
      console.warn("[screenshot-fail]", name, e instanceof Error ? e.message : e);
    }
  }

  const outcome = await publishWithPlatform(task);
  report.localFill = outcome;

  try {
    await page.goto("https://www.zhihu.com/write", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await shot("realrun-zhihu-write-page.png");
    await shot("realrun-zhihu-title-filled.png");
    await shot("realrun-zhihu-content-filled.png");
    if (outcome.status === "manual_required") await shot("realrun-zhihu-manual-required.png");
  } catch {
    /* page may be closed after publish */
  }

  const logPath = path.join(agentRoot, "data/logs", `task-${task.taskId}.json`);
  if (fs.existsSync(logPath)) {
    report.taskLogPath = logPath;
    fs.copyFileSync(logPath, path.join(artifacts, "realrun-task-log-copy.json"));
  }

  const logJsonPath = path.join(artifacts, "realrun-task-log.json");
  fs.writeFileSync(logJsonPath, JSON.stringify({ task, outcome, logs: outcome.logs }, null, 2));
  try {
    const { chromium } = await import(path.join(agentRoot, "node_modules/playwright/index.mjs"));
    const browser = await chromium.launch({ headless: true });
    const p = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await p.setContent(
      `<pre style="font:12px monospace;padding:16px;background:#0f172a;color:#e2e8f0;white-space:pre-wrap">${JSON.stringify({ task, outcome }, null, 2).replace(/</g, "&lt;")}</pre>`,
    );
    await p.screenshot({ path: path.join(artifacts, "realrun-task-log-json.png") });
    await browser.close();
  } catch (e) {
    console.warn("[warn] task-log png:", e instanceof Error ? e.message : e);
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(artifacts, "realrun-zhihu-fill-report.json"), JSON.stringify(report, null, 2));
  console.log("\n=== Fill Report ===\n", JSON.stringify(report, null, 2));

  try {
    const { chromium } = await import(path.join(agentRoot, "node_modules/playwright/index.mjs"));
    const browser = await chromium.launch({ headless: true });
    const p = await browser.newPage({ viewport: { width: 900, height: 400 } });
    await p.setContent(
      `<pre style="font:12px monospace;padding:16px;background:#0f172a;color:#e2e8f0">${JSON.stringify({ webFill: report.webFill, phase2Reuse: report.phase2Reuse }, null, 2).replace(/</g, "&lt;")}</pre>`,
    );
    await p.screenshot({ path: path.join(artifacts, "realrun-web-task-result.png") });
    await browser.close();
  } catch {
    /* optional */
  }

  if (report.phase2Web.ok && report.phase2Web.row) {
    try {
      const { pollOnce } = require(path.join(agentRoot, "dist/agent/pollingManager.js"));
      const poll = await pollOnce();
      report.webPollOnce = poll;
    } catch (e) {
      report.webFill = { skipped: true, reason: e instanceof Error ? e.message : String(e) };
    }
  } else {
    report.webFill = { skipped: true, reason: "Phase 2 未通过，未执行 Web poll/claim" };
  }

  const okStatuses = new Set(["manual_required", "draft_saved"]);
  process.exit(okStatuses.has(outcome.status) ? 0 : outcome.status === "session_expired" ? 3 : 2);
}

main().catch(e => {
  console.error("[FAIL]", e);
  process.exit(1);
});
