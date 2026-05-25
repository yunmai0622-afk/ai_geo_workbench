#!/usr/bin/env node
/**
 * Phase 2：知乎登录态复用 + 写作页打开冒烟
 * 模拟：关闭 context（等同关客户端浏览器）→ 用同一 profilePath 再开
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const agentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(agentRoot, "..");
const artifacts = path.join(root, "artifacts");
const require = createRequire(import.meta.url);
const PROFILE = process.env.REALRUN_ZHIHU_PROFILE_ID || "zhihu_1779680573502";

async function screenshot(page, name) {
  if (!page) return;
  try {
    await page.screenshot({ path: path.join(artifacts, name), fullPage: false });
    console.log("[screenshot]", name);
  } catch (e) {
    console.warn("[screenshot-fail]", name, e.message);
  }
}

async function main() {
  if (!fs.existsSync(artifacts)) fs.mkdirSync(artifacts, { recursive: true });

  const { zhihuPublisher } = require(path.join(agentRoot, "dist/agent/platforms/zhihuPublisher.js"));
  const { closeAllContexts } = require(path.join(agentRoot, "dist/agent/platforms/browserSession.js"));
  const { readAccounts } = require(path.join(agentRoot, "dist/agent/storage.js"));

  await closeAllContexts();
  console.log("[step] all contexts closed (simulate client quit)");

  const before = readAccounts().accounts.find(a => a.profileId === PROFILE);
  if (!before) {
    console.error("[FAIL] profile_not_found in accounts.json", PROFILE);
    process.exit(1);
  }
  console.log("[PASS] account still in accounts.json", before.profilePath);

  const result = await zhihuPublisher.verifySessionReuseAndWritePage(PROFILE);
  fs.writeFileSync(path.join(artifacts, "phase2-session-reuse-report.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  const { getOpenContext } = require(path.join(agentRoot, "dist/agent/platforms/browserSession.js"));
  const ctx = getOpenContext(PROFILE);
  const page = ctx?.pages().find(p => !p.isClosed());

  if (result.write.ok) {
    await screenshot(page, "agent0-session-reuse-write-page.png");
  } else if (result.write.errorType === "session_expired" || result.home.errorType === "session_expired") {
    await screenshot(page, "agent0-session-expired-log.png");
  }

  await screenshot(page, "agent0-session-reuse-account-list.png");

  const passed =
    result.accountInJson &&
    result.profilePath === before.profilePath &&
    (result.write.ok || Boolean(result.write.errorType));

  process.exit(passed && result.write.ok ? 0 : passed ? 3 : 2);
}

main().catch(e => {
  console.error("[FAIL]", e);
  process.exit(1);
});
