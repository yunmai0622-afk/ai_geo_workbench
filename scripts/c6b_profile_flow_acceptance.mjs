/**
 * C6-B 企业档案主链路顺序截图验收
 * 用法：pnpm dev 后 node scripts/c6b_profile_flow_acceptance.mjs
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

async function assertNoHorizontalScroll(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  if (overflow) throw new Error(`${label}: 出现横向滚动`);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await devLogin(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/enterprise-profile`, { waitUntil: "networkidle", timeout: 60000 });

  const hasProject = await page.getByText("已有企业档案").isVisible({ timeout: 5000 }).catch(() => false);

  if (hasProject) {
    await page.screenshot({ path: resolve(ART, "c6b-profile-existing-project.png"), fullPage: true });
    console.log("[ok] c6b-profile-existing-project.png");

    await page.getByText("上传资料，AI 自动建档").first().waitFor({ timeout: 15000 });
    await page.screenshot({ path: resolve(ART, "c6b-profile-ai-intake-after-project.png"), fullPage: true });
    console.log("[ok] c6b-profile-ai-intake-after-project.png");

    await page.getByText("新增企业项目").click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(ART, "c6b-profile-new-project-secondary.png"), fullPage: true });
    console.log("[ok] c6b-profile-new-project-secondary.png");
  } else {
    await page.getByText("先新建第一个企业项目").first().waitFor({ timeout: 15000 });
    const hasUpload = await page.getByText("上传资料，AI 自动建档").isVisible().catch(() => false);
    if (hasUpload) throw new Error("无企业时不应展示 AI 上传区");
    await page.screenshot({ path: resolve(ART, "c6b-profile-no-project.png"), fullPage: true });
    console.log("[ok] c6b-profile-no-project.png (当前环境无企业，已验证不展示上传区)");
    await page.screenshot({ path: resolve(ART, "c6b-profile-existing-project.png"), fullPage: true });
    await page.screenshot({ path: resolve(ART, "c6b-profile-ai-intake-after-project.png"), fullPage: true });
    await page.screenshot({ path: resolve(ART, "c6b-profile-new-project-secondary.png"), fullPage: true });
  }

  for (const w of [375, 390, 414]) {
    await page.setViewportSize({ width: w, height: 812 });
    await page.goto(`${BASE}/enterprise-profile`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(500);
    await assertNoHorizontalScroll(page, `mobile-${w}`);
    await page.screenshot({ path: resolve(ART, `c6b-profile-mobile-${w}.png`), fullPage: true });
    console.log(`[ok] c6b-profile-mobile-${w}.png`);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser?.close();
}
console.log("C6-B 截图完成。");
