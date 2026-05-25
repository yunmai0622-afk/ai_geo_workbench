#!/usr/bin/env node
/**
 * Agent-Real-Run-1 入口：需已启动 Web(:3000) 与 local-agent HTTP(:39888)。
 *
 *   node scripts/agent_realrun1_acceptance.mjs
 *
 * 环境变量见 scripts/agent_realrun1_acceptance.ts
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn("npx", ["tsx", "scripts/agent_realrun1_acceptance.ts"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
child.on("close", code => process.exit(code ?? 1));
