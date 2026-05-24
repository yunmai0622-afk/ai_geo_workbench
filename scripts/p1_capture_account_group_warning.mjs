#!/usr/bin/env node
/** 单独截取账号组不一致提示（需 dev + 文章 recommendedAccountGroup 与平台 accountGroup 不同） */
import { chromium } from "playwright";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const ART = resolve(process.cwd(), "artifacts");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto(BASE, { waitUntil: "networkidle" });
  const login = page.getByRole("button", { name: "本地开发登录" });
  if (await login.isVisible({ timeout: 8000 }).catch(() => false)) await login.click();
  await page.waitForTimeout(1200);

  await page.goto(`${BASE}/weekly`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const card = page.locator(".ai-asset-card").filter({ hasText: "种草账号组" }).first();
  const publishBtn = card.getByRole("button", { name: "发布到平台" });
  if (!(await publishBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
    console.error("no card with 种草账号组 strategy");
    process.exitCode = 1;
  } else {
    await publishBtn.click();
    await page.waitForTimeout(400);
    const zhihu = page.locator("label").filter({ hasText: "知乎" }).locator('input[type="checkbox"]');
    await zhihu.check();
    await page.waitForTimeout(800);
    const hint = page.getByTestId("account-group-mismatch-hint");
    if (await hint.isVisible().catch(() => false)) {
      await page.getByRole("dialog").screenshot({ path: resolve(ART, "p1b-account-group-warning.png") });
      console.log("saved p1b-account-group-warning.png");
    } else {
      console.error("hint not visible; ensure article.recommendedAccountGroup != platform.accountGroup");
      process.exitCode = 1;
    }
  }
} finally {
  await browser.close();
}
