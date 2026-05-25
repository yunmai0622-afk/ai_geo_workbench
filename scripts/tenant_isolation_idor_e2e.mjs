#!/usr/bin/env node
/**
 * 双用户 IDOR E2E 入口：调用 tsx runner 并写入 artifacts/tenant-isolation-idor-e2e.json
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outPath = path.join(root, "artifacts/tenant-isolation-idor-e2e.json");

const run = spawnSync("pnpm", ["exec", "tsx", "scripts/tenant_isolation_idor_e2e_runner.ts"], {
  cwd: root,
  encoding: "utf8",
  env: process.env,
});

if (run.stdout) process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);

if (!fs.existsSync(outPath)) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    `${JSON.stringify({ pass: false, error: "runner did not write output", exitCode: run.status }, null, 2)}\n`,
  );
}

process.exit(run.status ?? 1);
