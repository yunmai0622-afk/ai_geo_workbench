#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "artifacts");
const baseUrl = process.env.SCREENSHOT_BASE_URL || "http://127.0.0.1:3000";

async function main() {
  const { chromium } = await import("playwright");
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const shots = [
    { file: "client-entry-dashboard-empty.png", url: `${baseUrl}/clients` },
    { file: "client-entry-create-project-dialog.png", url: `${baseUrl}/clients`, action: "dialog" },
    { file: "client-entry-profile-no-create.png", url: `${baseUrl}/enterprise-profile` },
    { file: "client-entry-profile-current-project.png", url: `${baseUrl}/enterprise-profile?projectId=1` },
    { file: "client-entry-onboarding-existing-project.png", url: `${baseUrl}/onboarding` },
    { file: "client-entry-created-go-profile.png", url: `${baseUrl}/enterprise-profile?projectId=1` },
  ];

  for (const { file, url, action } of shots) {
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(1200);
      if (action === "dialog") {
        const btn = page.getByTestId("create-client-project-button");
        if ((await btn.count()) > 0) {
          await btn.click();
          await page.waitForTimeout(800);
        }
      }
      await page.screenshot({ path: path.join(outDir, file), fullPage: true });
      console.log("[OK]", file);
    } catch (e) {
      console.error("[FAIL]", file, e.message);
    }
  }

  await browser.close();
}

main();
