import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";

async function metrics(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth > doc.clientWidth + 2;
    return {
      overflow,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      hasError: document.body.innerText.includes("页面遇到了意外问题"),
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const results = [];

  for (const path of ["/", "/register"]) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(800);
    results.push({ path, ...(await metrics(page)) });
  }

  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  const devBtn = page.getByRole("button", { name: /本地开发登录/ });
  if (await devBtn.count()) await devBtn.click();
  await page.waitForTimeout(1500);

  let projectId = null;
  const card = page.locator('[data-testid="client-project-card"]').first();
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(1200);
    const m = page.url().match(/projectId=(\d+)/);
    projectId = m?.[1] ?? null;
  }

  for (const path of [
    "/clients",
    ...(projectId
      ? [
          `/workspace?projectId=${projectId}`,
          `/ai-diagnosis?projectId=${projectId}`,
          `/content-publishing?projectId=${projectId}`,
        ]
      : []),
  ]) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1200);
    results.push({ path, ...(await metrics(page)) });
  }

  await browser.close();
  console.log(JSON.stringify({ projectId, results }, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
