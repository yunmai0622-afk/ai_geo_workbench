#!/usr/bin/env node
/**
 * Agent-Migration-2：Web 发布主链路不再默认 Chrome 插件
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf-8");
}

function must(cond, msg) {
  if (!cond) {
    console.error("[FAIL]", msg);
    process.exit(1);
  }
  console.log("[OK]", msg);
}

const weekly = read("client/src/pages/WeeklyContentPage.tsx");
const router = read("server/publishTasksRouter.ts");
const binding = read("client/src/components/PlatformAccountBindingSection.tsx");

must(!/Chrome\s*插件|重载插件|下载插件|插件版本/.test(weekly), "weekly no extension main copy");
must(!weekly.includes("downloadExtension"), "weekly no downloadExtension");
must(weekly.includes("发布任务已发送至本地客户端"), "local agent success toast");
must(router.includes('status: "pending_agent"'), "pending_agent status");
must(router.includes("localProfileId"), "localProfileId required path");
must(router.includes('sessionStatus !== "active"'), "session active check");
const createBlock = router.slice(router.indexOf("create: protectedProcedure"), router.indexOf("verifyPublishTask:"));
must(!createBlock.includes(': "pending"'), "create does not insert extension pending");
must(createBlock.includes("publishMode: \"local_agent\""), "create returns local_agent mode");
must(fs.existsSync(path.join(root, "content-growth-publish-extension/manifest.json")), "legacy extension source kept");
must(!weekly.includes("content-growth-publish-extension"), "weekly does not reference extension package");
must(binding.includes("旧账号"), "legacy account label");

fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
fs.writeFileSync(
  path.join(root, "artifacts/agent-migration-report.md"),
  `# Agent-Migration-2 验收报告\n\n- 发布主链路：Local Agent only\n- 新任务状态：pending_agent\n- Chrome 插件：legacy 源码保留，前端主流程不引用\n- 截图：需本机 \`pnpm dev\` 后补拍 artifacts/agent-migration-*.png\n`,
);

function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("\n--- pnpm check ---");
run("pnpm", ["check"]);
console.log("\n--- pnpm test ---");
run("pnpm", ["test"]);
console.log("\n--- pnpm build ---");
run("pnpm", ["build"]);
console.log("\n--- local-agent typecheck/build ---");
run("npm", ["run", "typecheck"], path.join(root, "local-agent"));
run("npm", ["run", "build"], path.join(root, "local-agent"));

console.log("\n=== agent_migration_no_chrome_plugin_acceptance PASSED ===\n");
