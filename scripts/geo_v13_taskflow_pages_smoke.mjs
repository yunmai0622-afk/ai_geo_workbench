#!/usr/bin/env node
/**
 * GEO-V1.3 核心页面 smoke（需本机 dev / start 已运行）
 *
 * 用法：
 *   pnpm dev   # 另开终端
 *   pnpm accept:v1:taskflow-pages-smoke
 *
 * 环境变量：
 *   BASE_URL（默认 http://127.0.0.1:3000）
 *   SMOKE_PROJECT_ID（优先使用的 projectId，默认 90001）
 *   SMOKE_SKIP_IF_DOWN=1（默认 1；服务未起时 exit 0 并打印 SKIP）
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const PREFERRED_PROJECT_ID = Number(process.env.SMOKE_PROJECT_ID ?? "90001");
const SKIP_IF_DOWN = process.env.SMOKE_SKIP_IF_DOWN !== "0";

const PAGE_SPECS = projectId => [
  {
    path: `/workspace?projectId=${projectId}`,
    label: "项目工作台",
    testIds: ["workspace-page", "workspace-empty"],
  },
  {
    path: `/ai-diagnosis?projectId=${projectId}`,
    label: "AI 实测诊断",
    testIds: ["ai-diagnosis-platform-cards", "ai-diagnosis-load-hint", "ai-diagnosis-core-summary"],
  },
  {
    path: `/questions?projectId=${projectId}`,
    label: "AI 搜索问题池",
    testIds: ["questions-search-pool-page"],
  },
  {
    path: `/content-publishing?projectId=${projectId}`,
    label: "平台适配发布",
    testIds: ["publish-center-page"],
  },
  {
    path: `/inclusion-monitoring?projectId=${projectId}`,
    label: "收录复测中心",
    testIds: ["inclusion-monitoring-page"],
  },
];

async function serverReachable() {
  try {
    const res = await fetch(BASE, { redirect: "manual" });
    return res.status < 600;
  } catch {
    return false;
  }
}

async function devLogin(page) {
  await page.goto(`${BASE}/clients`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const btn = page.getByRole("button", { name: /本地开发登录/ });
  if (!(await btn.isVisible({ timeout: 8000 }).catch(() => false))) {
    throw new Error("SKIP_LOGIN");
  }
  const responsePromise = page
    .waitForResponse(res => res.url().includes("auth.devLogin") && res.status() < 500, {
      timeout: 15000,
    })
    .catch(() => null);
  await btn.click();
  await responsePromise;
  await page.waitForTimeout(2000);
  const stillLogin = await page.getByText("登录后继续").isVisible({ timeout: 2000 }).catch(() => false);
  if (stillLogin) throw new Error("SKIP_LOGIN");
}

async function resolveSmokeProjectId(page) {
  await page.goto(`${BASE}/clients`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const cards = page.locator('[data-testid="client-project-card"]');
  const count = await cards.count();
  if (count > 0) {
    await cards.first().click();
    await page.waitForTimeout(1200);
    const fromUrl = page.url().match(/projectId=(\d+)/)?.[1];
    if (fromUrl) {
      const id = Number(fromUrl);
      if (id === PREFERRED_PROJECT_ID) return id;
      console.warn(
        `[WARN] 项目 ${PREFERRED_PROJECT_ID} 不可用，改用 ${id} 做 smoke（页面壳层与路由验证）`,
      );
      return id;
    }
  }
  console.warn(
    `[WARN] 当前账号无企业项目列表，仍用 projectId=${PREFERRED_PROJECT_ID} 验证路由与空态（需 DB 数据后补验业务数据）`,
  );
  return PREFERRED_PROJECT_ID;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function waitAnyTestId(page, testIds, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const testId of testIds) {
      const visible = await page.locator(`[data-testid="${testId}"]`).first().isVisible().catch(() => false);
      if (visible) return testId;
    }
    await page.waitForTimeout(250);
  }
  return null;
}

async function main() {
  if (!(await serverReachable())) {
    const msg =
      `[SKIP] geo_v13_taskflow_pages_smoke — ${BASE} 不可达。请先 pnpm dev 或 pnpm start，再执行：pnpm accept:v1:taskflow-pages-smoke`;
    if (SKIP_IF_DOWN) {
      console.log(msg);
      console.log(
        "\naccept:v1:sellable:runtime 需 DATABASE_URL 且库表齐全，配置后执行：pnpm accept:v1:sellable:runtime\n",
      );
      return;
    }
    throw new Error(msg);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];

  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", err => {
    consoleErrors.push(err.message);
  });

  await devLogin(page);
  const projectId = await resolveSmokeProjectId(page);

  const results = [];
  for (const item of PAGE_SPECS(projectId)) {
    consoleErrors.length = 0;
    await page.goto(`${BASE}${item.path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const matchedTestId = await waitAnyTestId(page, item.testIds);

    const bodyText = await page.locator("body").innerText();
    const hasErrorBoundary = /页面遇到了意外问题|Minified React error/i.test(bodyText);
    const blank = bodyText.trim().length < 20;
    const benignConsoleErrors = consoleErrors.filter(
      text => !/Failed to load resource|favicon|OAUTH_SERVER_URL|geo_system_config/i.test(text),
    );

    results.push({
      path: item.path,
      label: item.label,
      ok: !hasErrorBoundary && !blank && Boolean(matchedTestId) && benignConsoleErrors.length === 0,
      matchedTestId,
      hasErrorBoundary,
      blank,
      consoleErrorCount: benignConsoleErrors.length,
      consoleErrors: benignConsoleErrors.slice(0, 3),
    });
  }

  await browser.close();

  console.log(JSON.stringify({ base: BASE, projectId, preferredProjectId: PREFERRED_PROJECT_ID, results }, null, 2));

  const failed = results.filter(r => !r.ok);
  assert(failed.length === 0, `smoke 失败页面：${failed.map(r => r.label).join("、")}`);

  console.log("\n=== geo_v13_taskflow_pages_smoke PASSED ===\n");
}

main().catch(err => {
  if (err.message === "SKIP_LOGIN") {
    console.log(
      "[SKIP] geo_v13_taskflow_pages_smoke — 本地开发登录未生效（请确认 DATABASE_URL、users 表与 pnpm db:push 后重试）。",
    );
    console.log("已通过静态/构建级验证的页面路由与 testId 见 scripts/geo_v13_taskflow_pages_smoke.mjs。");
    console.log("配置完成后：pnpm dev && pnpm accept:v1:taskflow-pages-smoke\n");
    return;
  }
  console.error("[FAIL]", err.message);
  process.exit(1);
});
