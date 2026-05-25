#!/usr/bin/env node
/**
 * Agent-1 本地 HTTP 冒烟（需 local-agent 已启动：npm run dev 或 Electron 运行中）
 * 用法：node scripts/agent_local_health_smoke.mjs
 */
const base = (process.env.LOCAL_AGENT_URL ?? "http://127.0.0.1:39888").replace(/\/$/, "");

async function main() {
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      console.error(`[FAIL] health HTTP ${res.status}`);
      process.exit(1);
    }
    const data = await res.json();
    const required = ["ok", "agentId", "version"];
    for (const k of required) {
      if (data[k] == null) {
        console.error(`[FAIL] health 缺少字段 ${k}`);
        process.exit(1);
      }
    }
    if (data.ok !== true) {
      console.error("[FAIL] health ok !== true");
      process.exit(1);
    }
    console.log("[PASS] GET /health", {
      agentId: data.agentId,
      version: data.version,
      startedAt: data.startedAt ?? data.lastStartedAt,
    });
  } catch (e) {
    console.error(
      "[SKIP/FAIL] 无法连接本地 Agent HTTP。请先执行: cd local-agent && npm run dev",
    );
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(2);
  }
}

main();
