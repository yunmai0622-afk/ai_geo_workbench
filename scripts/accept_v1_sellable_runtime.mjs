#!/usr/bin/env node
/**
 * GEO V1 可售卖运行时验收（需 DATABASE_URL；部分步骤需 LLM 环境变量）
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

if (!process.env.DATABASE_URL?.trim()) {
  console.log(
    "[SKIP] accept:v1:sellable:runtime — 未设置 DATABASE_URL，跳过 DB/真实链路验收。\n" +
      "  部署或本机联调时请配置 DATABASE_URL 后执行：pnpm accept:v1:sellable:runtime\n",
  );
  process.exit(0);
}

const steps = [
  ["p0_real_chain_acceptance", "pnpm", ["exec", "tsx", "scripts/p0_real_chain_acceptance.ts"]],
  ["accept:p0:enterprise-profile", "pnpm", ["accept:p0:enterprise-profile"]],
  ["accept:p0:ai-diagnosis", "pnpm", ["accept:p0:ai-diagnosis"]],
  ["accept:p0:content-generation", "pnpm", ["accept:p0:content-generation"]],
];

for (const [label, command, args] of steps) {
  run(label, command, args);
}

console.log("\n=== accept:v1:sellable:runtime PASSED ===\n");
console.log(
  "可选（需 pnpm dev + Playwright）：\n" +
    "  C1F_BASE_URL=http://localhost:3000 node scripts/c1f_browser_delivery_acceptance.mjs\n",
);
