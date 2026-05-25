#!/usr/bin/env node
/**
 * Phase B：文章生命周期与 Agent 发布任务状态打通（静态 + Web 测试）
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function must(file, needles) {
  const text = fs.readFileSync(path.join(root, file), "utf-8");
  for (const n of needles) {
    if (!text.includes(n)) failures.push(`${file} 缺少 ${n}`);
  }
}

must("server/agentArticleLifecycle.ts", ["syncArticleLifecycleFromAgentTask", "草稿已保存", "待人工确认"]);
must("server/agentPublishTasks.ts", ["syncArticleLifecycleFromAgentTask", "articleLifecycle"]);
must("server/agentPublishTasks.ts", ["draft_saved 必须提供", "completed 状态必须提供 publicUrl"]);

try {
  execSync("pnpm check", { cwd: root, stdio: "inherit" });
} catch {
  failures.push("pnpm check");
}

try {
  execSync("pnpm exec vitest run server/v12PhaseBArticleLifecycle.test.ts server/v12Agent2Publish.test.ts", {
    cwd: root,
    stdio: "inherit",
  });
} catch {
  failures.push("vitest Phase B");
}

if (failures.length) {
  console.error("[FAIL]", failures);
  process.exit(1);
}
console.log("[PASS] Phase B 工程验收通过");
process.exit(0);
