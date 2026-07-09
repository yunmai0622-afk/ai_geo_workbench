#!/usr/bin/env node
/**
 * 模拟 HTTPS 生产页面对本机 Local Agent 的 OPTIONS 预检（CORS + Private Network Access）。
 * 用法：node scripts/verify_local_agent_browser_direct.mjs
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const PRODUCTION_ORIGIN = "https://aigeoworkbench00-production.up.railway.app";
const HEALTH_URL = "http://127.0.0.1:39888/health";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agentRoot = path.join(root, "local-agent");

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: "inherit", shell: true });
    p.on("error", reject);
    p.on("close", code => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

async function waitHealth(maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("local agent /health not reachable on 127.0.0.1:39888");
}

async function probeOptions(url, origin) {
  const res = await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Private-Network": "true",
    },
    signal: AbortSignal.timeout(5000),
  });
  return {
    status: res.status,
    allowOrigin: res.headers.get("access-control-allow-origin"),
    allowMethods: res.headers.get("access-control-allow-methods"),
    allowHeaders: res.headers.get("access-control-allow-headers"),
    allowPrivateNetwork: res.headers.get("access-control-allow-private-network"),
  };
}

function printProbe(label, probe) {
  console.log(`\n=== ${label} ===`);
  console.log(`OPTIONS status: ${probe.status}`);
  console.log(`Access-Control-Allow-Origin: ${probe.allowOrigin ?? "(missing)"}`);
  console.log(`Access-Control-Allow-Methods: ${probe.allowMethods ?? "(missing)"}`);
  console.log(`Access-Control-Allow-Headers: ${probe.allowHeaders ?? "(missing)"}`);
  console.log(`Access-Control-Allow-Private-Network: ${probe.allowPrivateNetwork ?? "(missing)"}`);
}

async function main() {
  let child = null;

  try {
    await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) });
  } catch {
    console.log("[info] 本机 Agent 未响应，临时启动 HTTP server 进行探测…");
    await run("npm", ["run", "build"], agentRoot);
    child = spawn(
      "node",
      ["-e", `require('./dist/agent/localServer').startLocalAgentServer();`],
      { cwd: agentRoot, stdio: "pipe" },
    );
    await waitHealth();
  }

  try {
    const healthProbe = await probeOptions(HEALTH_URL, PRODUCTION_ORIGIN);
    printProbe(`OPTIONS ${HEALTH_URL}`, healthProbe);

    const accountsUrl = "http://127.0.0.1:39888/accounts";
    const accountsProbe = await probeOptions(accountsUrl, PRODUCTION_ORIGIN);
    printProbe(`OPTIONS ${accountsUrl}`, accountsProbe);

    const ok =
      (healthProbe.status === 204 || healthProbe.status === 200) &&
      healthProbe.allowOrigin === PRODUCTION_ORIGIN &&
      healthProbe.allowPrivateNetwork === "true" &&
      (accountsProbe.status === 204 || accountsProbe.status === 200) &&
      accountsProbe.allowOrigin === PRODUCTION_ORIGIN &&
      accountsProbe.allowPrivateNetwork === "true";

    if (!ok) {
      console.error("\n[FAIL] OPTIONS 预检未满足 CORS / Private Network Access 要求");
      process.exit(1);
    }

    console.log("\n[PASS] OPTIONS 预检满足 CORS + Private Network Access");
  } finally {
    if (child) child.kill("SIGTERM");
  }
}

main().catch(e => {
  console.error("[FAIL]", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
