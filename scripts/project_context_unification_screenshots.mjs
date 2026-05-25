/**
 * GEO-V1-A Project context unification screenshots
 * 用法：pnpm dev 后 node scripts/project_context_unification_screenshots.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const ART = resolve(process.cwd(), "artifacts");
mkdirSync(ART, { recursive: true });

async function devLogin(page) {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  const btn = page.getByRole("button", { name: "本地开发登录" });
  if (await btn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1500);
  }
}

async function shot(page, name) {
  const path = resolve(ART, name);
  await page.screenshot({ path, fullPage: true });
  console.log("[ok]", name);
}

async function firstProjectId(page) {
  await page.goto(`${BASE}/clients`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  const enter = page.getByRole("button", { name: "进入工作台" }).first();
  if (!(await enter.isVisible({ timeout: 10000 }).catch(() => false))) return null;
  await enter.click();
  await page.waitForURL(/projectId=\d+/, { timeout: 15000 }).catch(() => {});
  const url = page.url();
  const m = url.match(/projectId=(\d+)/);
  return m ? Number(m[1]) : null;
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await devLogin(page);

  await page.goto(`${BASE}/clients`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(600);
  await shot(page, "project-context-clients-enter.png");

  const projectId = await firstProjectId(page);
  if (projectId) {
    await page.waitForTimeout(800);
    await shot(page, "project-context-top-current-project.png");

    await page.goto(`${BASE}/enterprise-profile?projectId=${projectId}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(800);
    await shot(page, "project-context-profile-with-project.png");

    await page.goto(`${BASE}/weekly?projectId=${projectId}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(800);
    await shot(page, "project-context-weekly-with-project.png");

    await page.goto(`${BASE}/content-publishing?projectId=${projectId}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(800);
    await shot(page, "project-context-publishing-with-project.png");
  } else {
    console.warn("[warn] no project for projectId screenshots");
  }

  await page.evaluate(() => sessionStorage.removeItem("activeProjectId"));
  await page.goto(`${BASE}/weekly`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  await shot(page, "project-context-no-project-empty.png");
} finally {
  if (browser) await browser.close();
}

console.log("screenshots saved to artifacts/");
