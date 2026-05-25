/**
 * Agent-Real-Run-1 验收编排（依赖已启动的 local-agent HTTP :39888）。
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { eq } from "drizzle-orm";
import { geoArticles, projectPlatformAccounts, publishTasks } from "../drizzle/schema";
import { getDb } from "../server/db";
import { appRouter } from "../server/routers";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
const AGENT = "http://127.0.0.1:39888";

const user = {
  id: 1,
  openId: "agent-realrun1",
  role: "admin" as const,
  name: "Agent RealRun1",
  email: null,
  loginMethod: null,
  lastSignedIn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function agentPost(pathname: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${AGENT}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  return (await res.json()) as Record<string, unknown>;
}

async function fetchHealth() {
  const res = await fetch(`${AGENT}/health`, { signal: AbortSignal.timeout(5000) });
  assert(res.ok, `health HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

async function waitDetect(profileId: string, waitSec: number) {
  const deadline = Date.now() + waitSec * 1000;
  let last: Record<string, unknown> = {};
  while (Date.now() <= deadline) {
    last = await agentPost(`/profiles/${encodeURIComponent(profileId)}/detect-account`);
    console.log("[detect]", JSON.stringify(last));
    if (last.ok) return last;
    if (last.errorType !== "login_required") return last;
    await sleep(15000);
  }
  return last;
}

async function captureProfileScreenshot(profileId: string, filename: string) {
  const { chromium } = await import(path.join(root, "local-agent/node_modules/playwright/index.mjs"));
  const accPath = path.join(root, "local-agent/profiles", profileId);
  if (!fs.existsSync(accPath)) return false;
  const ctx = await chromium.launchPersistentContext(accPath, {
    headless: true,
    viewport: { width: 1280, height: 900 },
    locale: "zh-CN",
  });
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto("https://www.zhihu.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(artifacts, filename), fullPage: false });
    return true;
  } finally {
    await ctx.close();
  }
}

async function main() {
  if (!fs.existsSync(artifacts)) fs.mkdirSync(artifacts, { recursive: true });

  const report: Record<string, unknown> = {
    phase: "Agent-Real-Run-1",
    startedAt: new Date().toISOString(),
  };

  const health = await fetchHealth();
  report.health = health;
  fs.writeFileSync(path.join(artifacts, "realrun1-health.json"), JSON.stringify(health, null, 2));

  const projectId = Number(process.env.REALRUN1_PROJECT_ID ?? "72");
  const articleId = Number(process.env.REALRUN1_ARTICLE_ID ?? "52");
  const waitSec = Math.max(0, Number(process.env.REALRUN1_WAIT_LOGIN_SEC ?? "90") || 0);

  let profileId = process.env.REALRUN1_PROFILE_ID?.trim();
  if (!profileId) {
    const created = await agentPost("/profiles/create", { platform: "zhihu", projectId });
    profileId = String(created.profileId ?? "");
    assert(profileId, String(created.message ?? "create profile failed"));
  }
  report.localProfileId = profileId;
  report.localAgentId = health.agentId;

  const skipOpenLogin = process.env.REALRUN_SKIP_OPEN_LOGIN === "1";
  if (!skipOpenLogin) {
    console.log("[step] open-login — 请在弹出的 Chromium 窗口手动登录知乎");
    const open = await agentPost(`/profiles/${encodeURIComponent(profileId)}/open-login`);
    report.openLogin = open;
    await sleep(4000);
    await captureProfileScreenshot(profileId, "realrun1-zhihu-login-window.png");
  } else {
    report.openLogin = { skipped: true };
  }

  const detect = await waitDetect(profileId, waitSec);
  report.detect = detect;
  if (detect.ok) {
    await captureProfileScreenshot(profileId, "realrun1-detected-account.png");
  }

  const db = await getDb();
  assert(db, "no db");
  const caller = appRouter.createCaller({ user, req: {} as never, res: {} as never });

  let platformAccountId: number | null = null;
  if (detect.ok && detect.accountName) {
    const bound = await caller.geo.platformAccounts.bindLocalAgentAccount({
      projectId,
      platform: "zhihu",
      accountName: String(detect.accountName),
      localAgentId: String(health.agentId),
      localProfileId: profileId,
      sessionStatus: "active",
    });
    const row = bound.account;
    platformAccountId = row.id;
    report.bind = {
      accountName: row.accountName,
      localAgentId: row.localAgentId,
      localProfileId: row.localProfileId,
      sessionStatus: row.sessionStatus,
      verificationStatus: row.verificationStatus,
    };
  } else {
    report.bindSkipped = true;
    report.bindBlocker = detect.errorType ?? detect.message;
  }

  let taskId: number | null = null;
  if (platformAccountId) {
    const created = await caller.publishTasks.create({
      projectId,
      articleId,
      platform: "zhihu",
      platformAccountId,
    });
    taskId = created.taskId;
    report.createTask = created;
    const rows = await db.select().from(publishTasks).where(eq(publishTasks.id, taskId)).limit(1);
    report.publishTaskRow = rows[0] ?? null;

    const poll = await agentPost("/poll-once");
    report.pollOnce = poll;

    const after = await db.select().from(publishTasks).where(eq(publishTasks.id, taskId)).limit(1);
    report.taskAfterAgent = after[0] ?? null;

    const logPath = path.join(root, "local-agent/data/logs", `task-${taskId}.json`);
    if (fs.existsSync(logPath)) {
      report.taskLogPath = logPath;
      report.taskLog = JSON.parse(fs.readFileSync(logPath, "utf-8"));
    }
  }

  report.platformAccounts = (
    await db.select().from(projectPlatformAccounts).where(eq(projectPlatformAccounts.projectId, projectId))
  ).filter(r => r.platform === "zhihu");

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(artifacts, "realrun1-report.json"), JSON.stringify(report, null, 2));
  console.log("\n=== RealRun1 Report ===\n", JSON.stringify(report, null, 2));

  if (!detect.ok) process.exit(2);
}

main().catch(e => {
  console.error("[FAIL]", e);
  process.exit(1);
});
