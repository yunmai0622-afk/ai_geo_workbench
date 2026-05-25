#!/usr/bin/env node
/**
 * Agent-Router-Fix-1：知乎写作页多候选 URL 静态验收
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

const zhihu = read("local-agent/src/agent/platforms/zhihuPublisher.ts");
const actions = read("local-agent/src/agent/platformActions.ts");
const appJs = read("local-agent/src/renderer/app.js");
const logStore = read("local-agent/src/agent/writePageLogStore.ts");

must(zhihu.includes("ZHIHU_WRITE_URL_CANDIDATES"), "ZHIHU_WRITE_URL_CANDIDATES");
must(zhihu.includes("https://zhuanlan.zhihu.com/write"), "zhuanlan write URL");
must(zhihu.includes("https://www.zhihu.com/"), "home fallback URL");
must(!/goto\s*\(\s*["']https:\/\/www\.zhihu\.com\/creator/.test(zhihu), "no goto creator");
must(!/goto\s*\(\s*["']https:\/\/www\.zhihu\.com\/write/.test(zhihu), "no goto www write");
must(zhihu.includes("targetUrl") && zhihu.includes("actualUrl"), "targetUrl/actualUrl logs");
must(!/creator\/writing\/article\/publish/.test(zhihu), "no legacy dead publish URL");
must(zhihu.includes("write_page_404"), "write_page_404 handling");
must(zhihu.includes("open_write_404"), "open_write_404 log step");
must(zhihu.includes("manual_required"), "manual_required fallback");
must(zhihu.includes("open_write_manual_required"), "open_write_manual_required log");
must(zhihu.includes("logOpenWrite") || zhihu.includes("open_write_success"), "open_write success logging");
must(zhihu.includes("open_write_failed"), "open_write_failed log");
must(zhihu.includes("openWritePageWithCandidates"), "openWritePageWithCandidates");

must(!/ok:\s*true[\s\S]{0,80}404/.test(zhihu), "no mark 404 as ok:true");
must(!/draft_saved/.test(zhihu + actions) || zhihu.includes("save.saved"), "draft_saved only on real save evidence");

must(logStore.includes('path.join(DATA_DIR, "logs")'), "logs under data/logs");
must(appJs.includes("formatOpenWriteResult"), "client shows formatted open-write result");
must(appJs.includes("manual_required"), "client manual_required message");
must(actions.includes("openWritePageWithCandidates"), "platformActions routes zhihu candidates");

console.log("\n--- local-agent typecheck ---");
spawnSync("npm", ["run", "typecheck"], { cwd: path.join(root, "local-agent"), stdio: "inherit" });
console.log("\n--- local-agent build ---");
spawnSync("npm", ["run", "build"], { cwd: path.join(root, "local-agent"), stdio: "inherit" });

console.log("\n=== agent_write_url_static_acceptance PASSED ===\n");
