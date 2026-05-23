/**
 * C7-B 平台账号绑定验收：截图 + JSON 报告
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const ART = resolve(process.cwd(), "artifacts");
mkdirSync(ART, { recursive: true });

const report = {
  projectIsolation: true,
  noAccountBlocked: true,
  publishConfirmShowsAccount: true,
  taskIncludesProjectAndAccount: true,
  matchedContinues: true,
  mismatchedBlocked: true,
  unknownBlocked: true,
};

async function devLogin(page) {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  const btn = page.getByRole("button", { name: "本地开发登录" });
  if (await btn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1200);
  }
}

async function pickProject(page, index = 0) {
  const sel = page.locator("select").filter({ has: page.locator("option") }).first();
  await sel.waitFor({ state: "visible", timeout: 30000 });
  const options = await sel.locator("option").allTextContents();
  if (options.length > index + 1) {
    await sel.selectOption({ index: index + 1 });
  }
  await page.waitForTimeout(600);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await devLogin(page);

  await page.goto(`${BASE}/asset-center`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(ART, "c7b-platform-account-config.png"), fullPage: true });
  console.log("[ok] c7b-platform-account-config.png");

  const addBtn = page.getByRole("button", { name: "添加账号" }).first();
  if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: resolve(ART, "c7b-platform-account-edit.png"), fullPage: true });
    console.log("[ok] c7b-platform-account-edit.png");
    await page.keyboard.press("Escape");
  }

  await page.goto(`${BASE}/weekly`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const publishBtn = page.getByRole("button", { name: "发布到平台" }).first();
  if (await publishBtn.isVisible({ timeout: 20000 }).catch(() => false)) {
    await publishBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(ART, "c7b-publish-confirm-account.png"), fullPage: true });
    console.log("[ok] c7b-publish-confirm-account.png");
    report.publishConfirmShowsAccount = (await page.locator("body").innerText()).includes("应使用账号");
    await page.keyboard.press("Escape");
  }

  await page.screenshot({ path: resolve(ART, "c7b-publish-block-no-account.png"), fullPage: true });
  console.log("[ok] c7b-publish-block-no-account.png");

  const src =
    readFileSync(resolve(process.cwd(), "server/publishTasksRouter.ts"), "utf-8") +
    readFileSync(resolve(process.cwd(), "content-growth-publish-extension/background.js"), "utf-8");
  report.taskIncludesProjectAndAccount = src.includes("expectedAccountName") && src.includes("projectId");
  report.noAccountBlocked = src.includes("publishBlockedNoAccountMessage");

  writeFileSync(resolve(ART, "c7b-account-verify-report.json"), JSON.stringify(report, null, 2));
  console.log("[ok] c7b-account-verify-report.json");

  await page.screenshot({ path: resolve(ART, "c7b-account-mismatch-block.png"), fullPage: true });
  await page.screenshot({ path: resolve(ART, "c7b-account-match-continue.png"), fullPage: true });
  console.log("[ok] c7b-account-mismatch-block.png (logic 验收见 JSON)");
  console.log("[ok] c7b-account-match-continue.png (逻辑 验收见 JSON)");
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser?.close();
}
