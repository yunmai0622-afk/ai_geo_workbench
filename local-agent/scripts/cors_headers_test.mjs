#!/usr/bin/env node
/**
 * 验证 Local Agent CORS / Private Network Access 响应头（不依赖 Electron 运行时）。
 */
import http from "http";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const PRODUCTION_ORIGIN = "https://aigeoworkb-kzxhj9uy.manus.space";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corsModulePath = path.join(root, "dist/agent/cors.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("[FAIL]", msg);
    process.exit(1);
  }
}

async function loadCorsHelpers() {
  return import(pathToFileURL(corsModulePath).href);
}

function startCorsTestServer(buildLocalAgentCorsHeaders) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
      const pathname = req.url?.split("?")[0] ?? "/";

      if (req.method === "OPTIONS") {
        res.writeHead(204, buildLocalAgentCorsHeaders(origin));
        res.end();
        return;
      }

      if (req.method === "GET" && (pathname === "/health" || pathname === "/accounts")) {
        const body =
          pathname === "/health"
            ? JSON.stringify({ ok: true, version: "test" })
            : JSON.stringify({ accounts: [] });
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          ...buildLocalAgentCorsHeaders(origin),
        });
        res.end(body);
        return;
      }

      res.writeHead(404, buildLocalAgentCorsHeaders(origin));
      res.end();
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function waitHealth(base, maxMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error("health timeout");
}

async function optionsProbe(base, pathname) {
  const res = await fetch(`${base}${pathname}`, {
    method: "OPTIONS",
    headers: {
      Origin: PRODUCTION_ORIGIN,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Private-Network": "true",
    },
  });
  return {
    status: res.status,
    allowOrigin: res.headers.get("access-control-allow-origin"),
    allowMethods: res.headers.get("access-control-allow-methods"),
    allowHeaders: res.headers.get("access-control-allow-headers"),
    allowPrivateNetwork: res.headers.get("access-control-allow-private-network"),
  };
}

async function getProbe(base, pathname) {
  const res = await fetch(`${base}${pathname}`, {
    method: "GET",
    headers: { Origin: PRODUCTION_ORIGIN },
  });
  return {
    status: res.status,
    allowOrigin: res.headers.get("access-control-allow-origin"),
    allowPrivateNetwork: res.headers.get("access-control-allow-private-network"),
    ok: res.ok,
  };
}

async function main() {
  const { buildLocalAgentCorsHeaders } = await loadCorsHelpers();
  const server = await startCorsTestServer(buildLocalAgentCorsHeaders);
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : null;
  assert(port, "failed to bind ephemeral test server");

  const base = `http://127.0.0.1:${port}`;
  try {
    await waitHealth(base);

    for (const pathname of ["/health", "/accounts"]) {
      const opt = await optionsProbe(base, pathname);
      assert(opt.status === 204 || opt.status === 200, `${pathname} OPTIONS status=${opt.status}`);
      assert(opt.allowOrigin === PRODUCTION_ORIGIN, `${pathname} OPTIONS missing Allow-Origin`);
      assert(opt.allowMethods?.includes("GET"), `${pathname} OPTIONS missing GET in Allow-Methods`);
      assert(
        opt.allowPrivateNetwork === "true",
        `${pathname} OPTIONS missing Access-Control-Allow-Private-Network: true`,
      );

      const get = await getProbe(base, pathname);
      assert(get.ok, `${pathname} GET failed status=${get.status}`);
      assert(get.allowOrigin === PRODUCTION_ORIGIN, `${pathname} GET missing Allow-Origin`);
      assert(
        get.allowPrivateNetwork === "true",
        `${pathname} GET missing Access-Control-Allow-Private-Network: true`,
      );
    }

    console.log("[PASS] cors_headers_test ok");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(e => {
  console.error("[FAIL]", e.message);
  process.exit(1);
});
