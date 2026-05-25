#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "artifacts");
const baseUrl = process.env.SCREENSHOT_BASE_URL || "http://127.0.0.1:3000";
const projectId = process.env.SCREENSHOT_PROJECT_ID || "1";

async function main() {
  const { chromium } = await import("playwright");
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const shots = [
    { file: "workspace-state-current-stage.png", url: `${baseUrl}/workspace?projectId=${projectId}` },
    { file: "workspace-state-progress.png", url: `${baseUrl}/workspace?projectId=${projectId}` },
    { file: "workspace-state-blockers.png", url: `${baseUrl}/workspace?projectId=${projectId}` },
    { file: "workspace-state-empty.png", url: `${baseUrl}/workspace` },
  ];

  for (const { file, url } of shots) {
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, file), fullPage: true });
      console.log("[OK]", file);
    } catch (e) {
      console.error("[FAIL]", file, e.message);
    }
  }

  await browser.close();
}

main();
