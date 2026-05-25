#!/usr/bin/env node
/**
 * Agent-0 知乎检测冒烟（需 local-agent HTTP 已启动，建议先客户端登录）
 * REALRUN_LOGIN_WAIT_SEC=90 node scripts/agent0_zhihu_detect_smoke.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
const PROFILE = process.env.REALRUN_ZHIHU_PROFILE_ID || "zhihu_1779680573502";
const WAIT = Math.max(0, Number(process.env.REALRUN_LOGIN_WAIT_SEC ?? "0") || 0);

async function post(pathname, body = {}) {
  const res = await fetch(`http://127.0.0.1:39888${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  return res.json();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  if (!fs.existsSync(artifacts)) fs.mkdirSync(artifacts, { recursive: true });
  await fetch("http://127.0.0.1:39888/health").then(r => r.json()).then(console.log);

  console.log("[step] open-login");
  console.log(await post(`/profiles/${encodeURIComponent(PROFILE)}/open-login`));

  if (WAIT > 0) {
    console.log(`[wait] ${WAIT}s for manual login...`);
    await sleep(WAIT * 1000);
  }

  console.log("[step] detect-account");
  const detect = await post(`/profiles/${encodeURIComponent(PROFILE)}/detect-account`);
  console.log(JSON.stringify(detect, null, 2));

  fs.writeFileSync(path.join(artifacts, "agent0-detect-smoke.json"), JSON.stringify(detect, null, 2));
  process.exit(detect.ok ? 0 : 2);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
