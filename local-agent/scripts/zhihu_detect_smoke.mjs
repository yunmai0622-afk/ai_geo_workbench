#!/usr/bin/env node
/**
 * 知乎 detect 冒烟（单进程，与 Electron 客户端相同逻辑）
 *
 * 用法：
 *   node scripts/zhihu_detect_smoke.mjs
 *   REALRUN_LOGIN_WAIT_SEC=120 node scripts/zhihu_detect_smoke.mjs
 */
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const agentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const PROFILE = process.env.REALRUN_ZHIHU_PROFILE_ID || "zhihu_1779680573502";
const WAIT = Math.max(0, Number(process.env.REALRUN_LOGIN_WAIT_SEC ?? "0") || 0);

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const { zhihuPublisher } = require(path.join(agentRoot, "dist/agent/platforms/zhihuPublisher.js"));
  const { closeContext } = require(path.join(agentRoot, "dist/agent/platforms/browserSession.js"));
  const { readAccounts } = require(path.join(agentRoot, "dist/agent/storage.js"));

  await closeContext(PROFILE);
  const acc = readAccounts().accounts.find(a => a.profileId === PROFILE);
  if (!acc) {
    console.error("[FAIL] profile_not_found", PROFILE);
    process.exit(1);
  }
  console.log("[info] profilePath", acc.profilePath);

  const open = await zhihuPublisher.openLoginHome(PROFILE);
  console.log("[open-login]", open);
  if (!open.ok) process.exit(2);

  if (WAIT > 0) {
    console.log(`[wait] ${WAIT}s — 请在弹出窗口登录知乎，勿关闭窗口`);
    await sleep(WAIT * 1000);
  }

  const detect = await zhihuPublisher.detectAccountSession(PROFILE);
  console.log("[detect]", JSON.stringify(detect, null, 2));
  const after = readAccounts().accounts.find(a => a.profileId === PROFILE);
  console.log("[account]", after?.accountName, after?.sessionStatus, after?.lastDetectMessage);

  process.exit(detect.ok ? 0 : detect.errorType === "login_required" ? 3 : 2);
}

main().catch(e => {
  console.error("[FAIL]", e);
  process.exit(1);
});
