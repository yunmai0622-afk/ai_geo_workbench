#!/usr/bin/env node
/**
 * GEO V1 可售卖静态验收（本地/CI 默认必跑）
 * 不启动 dev server；不调用真实 LLM。
 */
import { spawnSync } from "node:child_process";

const root = process.cwd();

function run(label, command, args) {
  console.log(`\n=== ${label} ===\n`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    console.error(`\n[FAIL] ${label} (exit ${result.status ?? 1})\n`);
    process.exit(result.status ?? 1);
  }
}

const steps = [
  ["pnpm check", "pnpm", ["check"]],
  ["pnpm build", "pnpm", ["build"]],
  ["pnpm test", "pnpm", ["test"]],
  ["enterprise_workspace_state_machine_acceptance", "node", ["scripts/enterprise_workspace_state_machine_acceptance.mjs"]],
  ["v12_ui_acceptance_check", "node", ["scripts/v12_ui_acceptance_check.mjs"]],
  ["agent_migration_no_chrome_plugin_acceptance", "node", ["scripts/agent_migration_no_chrome_plugin_acceptance.mjs"]],
  ["agent_mac_download_package_acceptance", "node", ["scripts/agent_mac_download_package_acceptance.mjs"]],
];

for (const [label, command, args] of steps) {
  run(label, command, args);
}

console.log("\n=== accept:v1:sellable:static PASSED ===\n");
