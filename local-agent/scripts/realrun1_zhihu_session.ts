/**
 * Agent-Real-Run-1：知乎 profile 登录窗口截图 + 检测昵称 + 可选填稿试跑。
 * 须在已启动 HTTP 的同一进程外独立运行（会启动浏览器窗口）。
 *
 * 环境变量：
 * - REALRUN1_PROFILE_ID — 已有 profile，默认读 accounts.json 首个知乎
 * - REALRUN1_WAIT_LOGIN_SEC — 登录后轮询检测秒数，默认 0
 * - REALRUN1_RUN_PUBLISH — 设为 1 时在检测成功后执行 publish（需 REALRUN1_TASK_JSON）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { openLoginWindow, detectPlatformAccount } from "../src/agent/platformActions";
import { publishWithPlatform } from "../src/agent/platforms/publisherFactory";
import type { LocalPublishTask } from "../src/agent/platforms/basePublisher";
import { getOpenContext } from "../src/agent/platforms/browserSession";
import { readAccounts } from "../src/agent/storage";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifacts = path.join(root, "artifacts");

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function screenshotOpenPage(profileId: string, filename: string) {
  const ctx = getOpenContext(profileId);
  if (!ctx) return false;
  const page = ctx.pages()[0];
  if (!page) return false;
  await page.screenshot({ path: path.join(artifacts, filename), fullPage: false });
  return true;
}

async function main() {
  if (!fs.existsSync(artifacts)) fs.mkdirSync(artifacts, { recursive: true });

  let profileId = process.env.REALRUN1_PROFILE_ID?.trim();
  if (!profileId) {
    const zh = readAccounts().accounts.find(a => a.platform === "zhihu");
    profileId = zh?.profileId;
  }
  if (!profileId) {
    console.error("[FAIL] 无知乎 profile，请先 POST /profiles/create");
    process.exit(1);
  }

  console.log("[step] open-login", profileId);
  const open = await openLoginWindow(profileId);
  console.log(JSON.stringify(open));
  await sleep(3000);
  const shotLogin = await screenshotOpenPage(profileId, "realrun1-zhihu-login-window.png");
  console.log(shotLogin ? "[ok] realrun1-zhihu-login-window.png" : "[warn] 登录窗口截图失败（无打开中的 context）");

  const waitSec = Math.max(0, Number(process.env.REALRUN1_WAIT_LOGIN_SEC ?? "0") || 0);
  let detect = await detectPlatformAccount(profileId);
  console.log("[detect]", JSON.stringify(detect));

  if (!detect.ok && waitSec > 0) {
    const deadline = Date.now() + waitSec * 1000;
    while (Date.now() < deadline) {
      await sleep(15000);
      detect = await detectPlatformAccount(profileId);
      console.log("[detect-retry]", JSON.stringify(detect));
      if (detect.ok) break;
      if (detect.step !== "login_required") break;
    }
  }

  if (detect.ok && detect.data?.accountName) {
    await screenshotOpenPage(profileId, "realrun1-detected-account.png");
    console.log("[ok] realrun1-detected-account.png");
  }

  if (process.env.REALRUN1_RUN_PUBLISH === "1" && detect.ok) {
    const raw = process.env.REALRUN1_TASK_JSON;
    if (!raw) {
      console.error("[FAIL] REALRUN1_RUN_PUBLISH=1 需要 REALRUN1_TASK_JSON");
      process.exit(1);
    }
    const task = JSON.parse(raw) as LocalPublishTask;
    console.log("[step] publish", task.taskId);
    const outcome = await publishWithPlatform(task);
    console.log("[publish]", JSON.stringify(outcome));
    const ctx = getOpenContext(profileId);
    const page = ctx?.pages()[0];
    if (page) {
      await page.screenshot({
        path: path.join(artifacts, "realrun1-zhihu-filled-title-content.png"),
        fullPage: false,
      });
    }
    process.exit(outcome.status === "failed" ? 2 : 0);
  }

  process.exit(detect.ok ? 0 : 2);
}

main().catch(e => {
  console.error("[FAIL]", e);
  process.exit(1);
});
