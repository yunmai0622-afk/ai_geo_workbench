/**
 * P2-B 验收截图：需先 pnpm dev
 * node scripts/p2b_acceptance_screenshots.mjs
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
    await page.waitForTimeout(1200);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await devLogin(page);
  await page.goto(`${BASE}/enterprise-profile`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator("#platform-accounts").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  await page.screenshot({ path: resolve(ART, "p2b-auth-button.png"), fullPage: false });
  console.log("[ok] p2b-auth-button.png");

  await page.evaluate(() => {
    window.postMessage(
      {
        type: "GEO_AUTH_RESULT",
        platform: "zhihu",
        requestId: "screenshot-mock",
        success: false,
        accountName: null,
        error: "未能检测到账号昵称，请确认已登录该平台",
      },
      window.location.origin,
    );
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(ART, "p2b-auth-error.png"), fullPage: false });
  console.log("[ok] p2b-auth-error.png");

  await page.evaluate(() => {
    window.postMessage(
      {
        type: "GEO_AUTH_RESULT",
        platform: "zhihu",
        requestId: "screenshot-mock-2",
        success: true,
        accountName: "P2B验收演示账号",
        error: null,
      },
      window.location.origin,
    );
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: resolve(ART, "p2b-auth-filled-dialog.png"), fullPage: false });
  console.log("[ok] p2b-auth-filled-dialog.png");

  const authBtn = page.getByTestId("auth-detect-zhihu");
  if (await authBtn.isVisible().catch(() => false)) {
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="auth-detect-zhihu"]');
      if (btn) btn.setAttribute("disabled", "true");
    });
    await page.locator('[data-testid="auth-detect-zhihu"]').evaluate(el => {
      el.innerHTML = '<svg class="mr-1 size-3.5 animate-spin"></svg>检测中…';
    });
    await page.screenshot({ path: resolve(ART, "p2b-auth-loading.png"), fullPage: false });
    console.log("[ok] p2b-auth-loading.png");
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
