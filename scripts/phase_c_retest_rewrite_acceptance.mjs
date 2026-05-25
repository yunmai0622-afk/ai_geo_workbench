#!/usr/bin/env node
/**
 * Phase C：发布后复测队列与重写池最小闭环
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

must("server/postPublishWorkflow.ts", ["listPostPublishRetestQueue", "listRewritePool"]);
must("server/routers.ts", ["retestQueue:", "rewritePool:"]);
must("client/src/pages/V12FlowPages.tsx", ["geo.articles.retestQueue", "重写池"]);

try {
  execSync("pnpm exec vitest run server/v12PhaseCPostPublishWorkflow.test.ts", { cwd: root, stdio: "inherit" });
} catch {
  failures.push("vitest Phase C");
}

try {
  execSync("pnpm build", { cwd: root, stdio: "inherit" });
} catch {
  failures.push("pnpm build");
}

if (failures.length) {
  console.error("[FAIL]", failures);
  process.exit(1);
}
console.log("[PASS] Phase C 工程验收通过");
process.exit(0);
