#!/usr/bin/env node
/**
 * 仅启动 local-agent HTTP（不启 Electron），用于 CI/验收 health。
 * 用法：node scripts/agent_http_server_smoke.mjs
 * 会先 build local-agent，启动 39888，请求 /health 后退出。
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agentRoot = path.join(root, "local-agent");

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: "inherit", shell: true });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

async function waitHealth(maxMs = 15000) {
  const base = "http://127.0.0.1:39888";
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.agentId) return data;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("health timeout");
}

async function main() {
  await run("npm", ["run", "build"], agentRoot);
  const child = spawn("node", ["-e", `
    const { startLocalAgentServer } = require('./dist/agent/localServer');
    startLocalAgentServer();
  `], { cwd: agentRoot, stdio: "pipe" });
  try {
    const data = await waitHealth();
    console.log("[PASS] local-agent HTTP /health", data);
  } finally {
    child.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error("[FAIL]", e.message);
  process.exit(1);
});
