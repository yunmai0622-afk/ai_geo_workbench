#!/usr/bin/env node
/**
 * GEO-V1-A 截图：需本地 dev 服务 http://127.0.0.1:5173 或 PORT
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "artifacts");
const baseUrl = process.env.SCREENSHOT_BASE_URL || "http://127.0.0.1:3000";

async function main() {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    console.error("playwright not installed; run: pnpm exec playwright install chromium");
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const shots = [
    { file: "project-context-clients-enter.png", url: `${baseUrl}/clients` },
    { file: "project-context-top-current-project.png", url: `${baseUrl}/workspace?projectId=1` },
    { file: "project-context-no-project-empty.png", url: `${baseUrl}/weekly` },
    { file: "project-context-profile-with-project.png", url: `${baseUrl}/enterprise-profile?projectId=1` },
    { file: "project-context-weekly-with-project.png", url: `${baseUrl}/weekly?projectId=1` },
    { file: "project-context-publishing-with-project.png", url: `${baseUrl}/content-publishing?projectId=1` },
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
