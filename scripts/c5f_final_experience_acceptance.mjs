/**
 * C5-F 侧栏对齐 + 目标客户问题连续重新生成验收
 * 用法：pnpm dev 后 node scripts/c5f_final_experience_acceptance.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const ART = resolve(process.cwd(), "artifacts");
const PROJECT_ID = process.env.C5F_PROJECT_ID ?? "72";
const ROUNDS = Number(process.env.C5F_ROUNDS ?? "3");
mkdirSync(ART, { recursive: true });

function normalizeKey(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000，。！？、；：""''（）\[\]【】.,;:'"()\-—·]/g, "")
    .replace(/[\?？]/g, "");
}

function isExactDup(a, b) {
  if (!a.trim() || !b.trim()) return false;
  if (a.trim() === b.trim()) return true;
  return normalizeKey(a) === normalizeKey(b);
}

function bigramJaccard(a, b) {
  const na = normalizeKey(a);
  const nb = normalizeKey(b);
  if (na.length < 2 || nb.length < 2) return na === nb ? 1 : 0;
  const sa = new Set();
  for (let i = 0; i < na.length - 1; i++) sa.add(na.slice(i, i + 2));
  const sb = new Set();
  for (let i = 0; i < nb.length - 1; i++) sb.add(nb.slice(i, i + 2));
  let inter = 0;
  sa.forEach(x => {
    if (sb.has(x)) inter++;
  });
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function isSimilar(a, b) {
  if (isExactDup(a, b)) return true;
  const na = normalizeKey(a);
  const nb = normalizeKey(b);
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    if (ratio >= 0.65) return true;
  }
  return bigramJaccard(a, b) >= 0.72;
}

function compareRounds(prev, curr) {
  let exact = 0;
  let similar = 0;
  for (const q of curr) {
    if (!q.trim()) continue;
    let exactHit = false;
    let similarHit = false;
    for (const p of prev) {
      if (isExactDup(q, p)) {
        exact++;
        exactHit = true;
        break;
      }
      if (!exactHit && isSimilar(q, p)) similarHit = true;
    }
    if (!exactHit && similarHit) similar++;
  }
  return { exact, similar };
}

async function devLogin(page) {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  const btn = page.getByRole("button", { name: "本地开发登录" });
  if (await btn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1200);
  }
}

async function pickProject(page) {
  const sel = page.locator("select").filter({ has: page.locator("option") }).first();
  await sel.waitFor({ state: "visible", timeout: 30000 });
  const has72 = await sel.locator(`option[value="${PROJECT_ID}"]`).count();
  if (has72 > 0) {
    await sel.selectOption(PROJECT_ID);
    return PROJECT_ID;
  }
  const options = await sel.locator("option").allTextContents();
  const match = options.find(t => t.includes("海豚知道") || t.includes("河南"));
  if (match) await sel.selectOption({ label: match });
  const value = await sel.inputValue();
  return value;
}

async function extractStep2Questions(page) {
  const step2 = page.locator("h3", { hasText: "目标客户问题" }).first().locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  const texts = await step2.locator("p.text-sm.leading-relaxed.text-slate-200").allTextContents();
  return texts.map(t => t.trim()).filter(Boolean);
}

async function waitRegenerateReady(page) {
  const regen = page.getByRole("button", { name: /^重新生成$/ }).first();
  await regen.waitFor({ state: "visible", timeout: 30000 });
  for (let i = 0; i < 240; i++) {
    if (await regen.isEnabled().catch(() => false)) return regen;
    await page.waitForTimeout(1500);
  }
  throw new Error("重新生成按钮长时间不可用（可能诊断仍在运行）");
}

async function waitRegenerateDone(page) {
  const regen = await waitRegenerateReady(page);
  await regen.click();
  await page.getByRole("button", { name: "正在生成…" }).waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
  await page.waitForFunction(
    () => {
      const buttons = [...document.querySelectorAll("button")];
      const regenBtn = buttons.find(b => b.textContent?.trim() === "重新生成");
      const runningDiag = buttons.some(b => /正在运行内容诊断/.test(b.textContent ?? ""));
      return regenBtn && !regenBtn.disabled && !runningDiag;
    },
    null,
    { timeout: 600000 },
  );
  await page.waitForTimeout(2000);
}

const report = { projectId: PROJECT_ID, rounds: [], uiChecks: {} };

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await devLogin(page);
  const pickedId = await pickProject(page);
  report.projectId = pickedId;

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/enterprise-profile`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByText("企业 AI 搜索档案").first().waitFor({ timeout: 30000 });
  await page.getByText("企业档案").first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: resolve(ART, "c5f-sidebar-enterprise-profile.png"), fullPage: true });
  console.log("[ok] c5f-sidebar-enterprise-profile.png");

  await page.goto(`${BASE}/ai-diagnosis`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByText("诊断流程控制台").first().waitFor({ timeout: 30000 });

  const hasInnerScroll = await page.evaluate(() => {
    const els = [...document.querySelectorAll("*")];
    return els.some(el => {
      const s = getComputedStyle(el);
      if (s.overflowY !== "auto" && s.overflowY !== "scroll") return false;
      if (el.scrollHeight <= el.clientHeight + 4) return false;
      const bg = s.backgroundColor;
      return /rgb\(255,\s*255,\s*255\)|#fff/i.test(bg);
    });
  });
  report.uiChecks.innerWhiteScroll = hasInnerScroll;

  let prev = [];
  for (let i = 1; i <= ROUNDS; i++) {
    await waitRegenerateDone(page);
    const questions = await extractStep2Questions(page);
    const actionText = (await page.locator(".rounded-2xl.border.p-4.text-sm").first().textContent().catch(() => "")) ?? "";
    const emptyCount = questions.filter(q => !q.trim()).length;
    const truncated = questions.some(q => q.endsWith("…"));
    const dup = i > 1 ? compareRounds(prev, questions) : { exact: 0, similar: 0 };
    report.rounds.push({
      round: i,
      count: questions.length,
      exactDupVsPrev: dup.exact,
      similarDupVsPrev: dup.similar,
      emptyCount,
      truncated,
      filteredHint: /过滤部分重复|新的目标客户问题/.test(actionText),
      actionSnippet: actionText.slice(0, 120),
      sample: questions.slice(0, 3),
    });
    await page.screenshot({ path: resolve(ART, `c5f-target-questions-round-${i}.png`), fullPage: true });
    console.log(`[ok] c5f-target-questions-round-${i}.png (${questions.length} 题, 完全重复 ${dup.exact}, 同义 ${dup.similar})`);
    prev = questions;
  }

  const diagnoseBtn = page.getByRole("button", { name: /重新诊断|开始 AI 内容诊断/ }).first();
  report.uiChecks.diagnosisButtonEnabled = await diagnoseBtn.isEnabled().catch(() => false);

  writeFileSync(resolve(ART, "c5f-regen-report.json"), JSON.stringify(report, null, 2));
  console.log("[report]", JSON.stringify(report, null, 2));

  const totalExact = report.rounds.slice(1).reduce((s, r) => s + r.exactDupVsPrev, 0);
  const totalSimilar = report.rounds.slice(1).reduce((s, r) => s + r.similarDupVsPrev, 0);
  if (totalExact > 2) console.warn(`[warn] 跨轮完全重复合计 ${totalExact}`);
  if (totalSimilar > 4) console.warn(`[warn] 跨轮同义重复合计 ${totalSimilar}`);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser?.close();
}
console.log("C5-F 验收完成。");
