#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
const agentRoot = path.join(root, "local-agent");
const logPath = path.join(artifacts, "agent0-detect-smoke.json");

async function main() {
  const payload = fs.existsSync(logPath)
    ? fs.readFileSync(logPath, "utf-8")
    : '{"note":"请先运行 agent0_zhihu_detect_smoke.mjs"}';
  const { chromium } = await import(path.join(agentRoot, "node_modules/playwright/index.mjs"));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 520 } });
  await page.setContent(
    `<pre style="font:13px monospace;padding:20px;background:#111;color:#f88;white-space:pre-wrap">Agent-0 知乎检测日志\n${payload.replace(/</g, "&lt;")}</pre>`,
  );
  fs.mkdirSync(artifacts, { recursive: true });
  await page.screenshot({ path: path.join(artifacts, "agent0-real-detect-failed-log.png") });
  await browser.close();
  console.log("[ok] artifacts/agent0-real-detect-failed-log.png");
}

main();
