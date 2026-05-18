/**
 * 百家号自动发布（Playwright + MySQL）
 *
 * 环境变量：
 *   DATABASE_URL          — 必填，与系统一致
 *   PUBLISH_PROJECT_ID    — 必填，当前要发布的项目 id
 *   ARTICLE_STATUS        — 可选，默认「质检通过」（库内 geo_articles.status 枚举无「待发布」）
 *
 * 运行示例：
 *   PUBLISH_PROJECT_ID=71 node scripts/publish_baijiahao.mjs
 *
 * 说明：百家号登录仅在浏览器内手动完成；脚本在终端用回车同步步骤。
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { chromium } from 'playwright';
import mysql from 'mysql2/promise';

const SCREENSHOT_DIR = path.join('screenshots', 'publish');

function isLoginUrl(url) {
  return typeof url === 'string' && url.includes('/login');
}

/** 库内枚举为「质检通过」，与需求「已质检通过」一致 */
const DEFAULT_ARTICLE_STATUS = process.env.ARTICLE_STATUS?.trim() || '质检通过';

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString('zh-CN')}] ${msg}`);
}

/** 百家号标题中企业全称 → 品牌简称（先于去前缀、截断处理） */
const BAIJIAHAO_TITLE_ENTERPRISE_FULL = '河南海豚知道文化传媒有限公司';
const BAIJIAHAO_TITLE_BRAND_SHORT = '海豚知道';

function replaceEnterpriseNameInTitle(title) {
  const t = title || '';
  if (!t.includes(BAIJIAHAO_TITLE_ENTERPRISE_FULL)) return t;
  return t.split(BAIJIAHAO_TITLE_ENTERPRISE_FULL).join(BAIJIAHAO_TITLE_BRAND_SHORT);
}

/**
 * 百家号标题：仅用数据库 `title` 字段。
 * 1) 将固定企业全称替换为品牌简称（如「河南海豚知道文化传媒有限公司」→「海豚知道」）；
 * 2) 若第一个全角「：」或半角「:」前的片段为「企业全称式」前缀（含有限公司等），则去掉该前缀及该分隔符；品牌简称「海豚知道：」等保留；
 * 3) 剩余部分按「汉字」（Unicode 统一表意文字）计数，最多保留 30 个汉字，超出则截断并加「...」；
 * 4) 不把正文、诊断或其它字段拼入标题。
 *
 * 例：`河南海豚知道文化传媒有限公司：当知识变现陷入瓶颈...`
 * → 替换后：`海豚知道：当知识变现陷入瓶颈...`（去前缀不触发）→ 再截断 30 字。
 */
function stripPrefixBeforeFirstColon(title) {
  const t = (title || '').trim();
  if (!t) return '';
  const iFull = t.indexOf('：');
  const iHalf = t.indexOf(':');
  const candidates = [iFull, iHalf].filter(i => i >= 0);
  if (candidates.length === 0) return t;
  const cut = Math.min(...candidates);
  const before = t.slice(0, cut);
  const after = t.slice(cut + 1).trim();
  // 仅去掉「企业全称式」前缀，避免把「海豚知道：」等品牌简称一并去掉
  if (/(有限公司|股份有限公司|有限责任公司|集团公司)/.test(before)) {
    return after || t;
  }
  return t;
}

const HAN_RE = /\p{Unified_Ideograph}/u;

function truncateToMaxHanChars(str, maxHan) {
  if (!str) return '';
  let hanCount = 0;
  let i = 0;
  while (i < str.length) {
    const cp = str.codePointAt(i);
    const ch = String.fromCodePoint(cp);
    const step = cp > 0xffff ? 2 : 1;
    if (HAN_RE.test(ch)) {
      hanCount += 1;
      if (hanCount > maxHan) {
        return `${str.slice(0, i)}...`;
      }
    }
    i += step;
  }
  return str;
}

/** 百家号正文标题（由 `article.title` 推导，不混入其它字段） */
function formatBaijiahaoArticleTitle(title) {
  const normalized = replaceEnterpriseNameInTitle((title || '').trim());
  const stripped = stripPrefixBeforeFirstColon(normalized);
  return truncateToMaxHanChars(stripped, 30);
}

/**
 * 将 Markdown 拆成可在百家号编辑器中顺序插入的块（大标题/小标题/正文/列表/行内加粗由步骤完成）
 */
function parseMarkdownToBlocks(markdown) {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
  /** @type {{ kind: 'h1' | 'h2' | 'p' | 'li'; text: string }[]} */
  const blocks = [];
  let paraBuf = [];

  const flushPara = () => {
    const t = paraBuf.join('\n').trim();
    if (t) blocks.push({ kind: 'p', text: t });
    paraBuf = [];
  };

  const parseInlineBold = raw => {
    const parts = [];
    const re = /\*\*([^*]+)\*\*/g;
    let last = 0;
    let m;
    while ((m = re.exec(raw)) !== null) {
      if (m.index > last) parts.push({ bold: false, text: raw.slice(last, m.index) });
      parts.push({ bold: true, text: m[1] });
      last = m.index + m[0].length;
    }
    if (last < raw.length) parts.push({ bold: false, text: raw.slice(last) });
    if (parts.length === 0) parts.push({ bold: false, text: raw });
    return parts;
  };

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    const ul = line.match(/^[\t ]*[-*]\s+(.+)$/);
    if (h1) {
      flushPara();
      blocks.push({ kind: 'h1', text: h1[1].trim() });
      continue;
    }
    if (h2) {
      flushPara();
      blocks.push({ kind: 'h2', text: h2[1].trim() });
      continue;
    }
    if (ul) {
      flushPara();
      blocks.push({ kind: 'li', text: ul[1].trim() });
      continue;
    }
    if (!line.trim()) {
      flushPara();
      continue;
    }
    paraBuf.push(line);
  }
  flushPara();

  /** 展开段落内的 **加粗** 为连续片段 */
  /** @type {{ kind: 'h1'|'h2'|'p'|'li'|'bold'; text: string }[]} */
  const expanded = [];
  for (const b of blocks) {
    if (b.kind === 'p') {
      const segs = parseInlineBold(b.text);
      for (const s of segs) {
        if (s.text) expanded.push(s.bold ? { kind: 'bold', text: s.text } : { kind: 'p', text: s.text });
      }
      continue;
    }
    if (b.kind === 'li') {
      const segs = parseInlineBold(b.text);
      for (const s of segs) {
        if (s.text) expanded.push(s.bold ? { kind: 'bold', text: s.text } : { kind: 'li', text: s.text });
      }
      continue;
    }
    expanded.push(b);
  }
  return expanded;
}

/** 已在上方 console.log 说明，此处仅等待用户按回车 */
function waitForEnterOnly() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

async function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('缺少 DATABASE_URL');
  return mysql.createConnection(url);
}

/**
 * 取第一篇：文章 status = 质检通过（可配），且该项目下存在内容计划 targetPlatforms 含「百家号」，
 * 且 content_plan_items 中 targetPlatform 为「百家号」并关联到该 articleId 或同 topicId。
 */
async function pickArticle(conn, projectId, status) {
  const [articles] = await conn.execute(
    `SELECT id, projectId, topicId, title, markdownContent, status
     FROM geo_articles
     WHERE projectId = ? AND status = ?
     ORDER BY updatedAt DESC`,
    [projectId, status],
  );
  if (!articles.length) return null;

  const [plans] = await conn.execute(`SELECT id, targetPlatforms FROM content_plans WHERE projectId = ?`, [projectId]);
  const bjhPlanIds = [];
  for (const p of plans) {
    let arr = p.targetPlatforms;
    if (typeof arr === 'string') {
      try {
        arr = JSON.parse(arr);
      } catch {
        arr = [];
      }
    }
    if (Array.isArray(arr) && arr.includes('百家号')) bjhPlanIds.push(p.id);
  }
  if (bjhPlanIds.length === 0) return null;

  const ph = bjhPlanIds.map(() => '?').join(',');
  const [items] = await conn.execute(
    `SELECT articleId, topicId, targetPlatform FROM content_plan_items
     WHERE planId IN (${ph}) AND targetPlatform = ?`,
    [...bjhPlanIds, '百家号'],
  );

  const byArticle = new Set(items.map(i => i.articleId).filter(Boolean));
  const byTopic = new Set(items.map(i => i.topicId).filter(Boolean));

  for (const a of articles) {
    if (byArticle.has(a.id)) return a;
  }
  for (const a of articles) {
    if (byTopic.has(a.topicId)) return a;
  }
  return null;
}

async function markArticlePublished(conn, articleId, publishNote) {
  const note = (publishNote || 'https://baijiahao.baidu.com').slice(0, 1000);
  await conn.execute(`UPDATE geo_articles SET status = '已发布', publicPath = ? WHERE id = ?`, [note, articleId]);
}

const BAIJIAHAO_NEWS_EDIT_URL = 'https://baijiahao.baidu.com/builder/rc/edit?type=news';

/**
 * 进入图文编辑页并等待加载完成（避免仍停在首页就去找标题框）
 */
async function gotoNewsEditor(page, debugShotDir, ts) {
  await page.goto(BAIJIAHAO_NEWS_EDIT_URL, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const inBuilder = () => {
    try {
      const u = page.url();
      return u.includes('baijiahao.baidu.com') && u.includes('/builder');
    } catch {
      return false;
    }
  };

  if (!inBuilder()) {
    log('未检测到已进入 /builder，再次导航编辑页…');
    await page.goto(BAIJIAHAO_NEWS_EDIT_URL, { waitUntil: 'load', timeout: 120_000 });
    await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(2500);
  }

  try {
    await page.waitForURL(
      u => u.hostname.includes('baijiahao.baidu.com') && u.href.includes('/builder'),
      { timeout: 90_000 },
    );
  } catch {
    /* 下面统一截图报错 */
  }

  if (!inBuilder()) {
    const dbg = path.join(debugShotDir, `baijiahao-debug-nav-${ts}.png`);
    await page.screenshot({ path: dbg, fullPage: true }).catch(() => {});
    console.error('[调试] 未能留在百家号编辑域，当前页面 URL:', page.url());
    console.error('[调试] 导航失败截图:', dbg);
    throw new Error('未能进入百家号编辑页（可能未登录或被重定向到登录页），请查看终端中的 URL 与截图');
  }

  await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

/**
 * 标题区：按用户要求先试 contenteditable，再试 class / data-placeholder，最后常见 input
 */
async function locateTitleField(page, debugShotDir, ts) {
  const candidates = [
    page.locator('div[contenteditable="true"]').first(),
    page.locator('.title-input, [data-placeholder*="标题"], div.input-title').first(),
    page.locator('input[placeholder*="标题"], input[placeholder*="请输入标题"]').first(),
  ];

  for (let i = 0; i < candidates.length; i++) {
    const loc = candidates[i];
    try {
      await loc.waitFor({ state: 'visible', timeout: 12_000 });
      if (await loc.isVisible().catch(() => false)) {
        log(`标题框命中策略 #${i + 1}`);
        return loc;
      }
    } catch {
      /* 下一策略 */
    }
  }

  const dbg = path.join(debugShotDir, `baijiahao-debug-title-${ts}.png`);
  await page.screenshot({ path: dbg, fullPage: true }).catch(() => {});
  console.error('[调试] 未找到标题输入框，当前页面 URL:', page.url());
  console.error('[调试] 标题查找失败截图:', dbg);
  throw new Error('未找到标题输入框（已截图并打印 URL，见终端）');
}

async function fillTitleField(locator, text) {
  const isContentEditable = await locator
    .evaluate(el => el instanceof HTMLElement && el.isContentEditable)
    .catch(() => false);
  if (isContentEditable) {
    await locator.click({ timeout: 15_000 });
    await locator.evaluate(el => {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    await locator.page().keyboard.press('Control+A');
    await locator.page().keyboard.press('Backspace');
    await locator.page().keyboard.type(text, { delay: 12 });
    return;
  }
  await locator.fill(text, { timeout: 15_000 });
}

/** 百家号正文区：多候选；若标题已占用第一个 contenteditable，则跳过 */
async function locateBodyEditor(page, { skipFirstContentEditable = false } = {}) {
  const candidates = [
    page.locator('div.ProseMirror[contenteditable="true"]'),
    page.locator('.ql-editor'),
    page.locator('[class*="editor"] [contenteditable="true"]'),
    page.locator('article [contenteditable="true"]'),
  ];
  for (const loc of candidates) {
    const first = loc.first();
    try {
      await first.waitFor({ state: 'visible', timeout: 5000 });
      return first;
    } catch {
      /* try next */
    }
  }
  const all = page.locator('[contenteditable="true"]');
  const n = await all.count();
  if (skipFirstContentEditable && n > 1) {
    for (let i = 1; i < n; i++) {
      const el = all.nth(i);
      if (await el.isVisible().catch(() => false)) return el;
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    const el = all.nth(i);
    if (await el.isVisible().catch(() => false)) return el;
  }
  return page.locator('[contenteditable="true"]').first();
}

async function clickToolbarIfVisible(page, nameRegex) {
  const btn = page.getByRole('button', { name: nameRegex }).first();
  if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(200);
    return true;
  }
  const span = page.locator('span,div,a').filter({ hasText: nameRegex }).first();
  if (await span.isVisible({ timeout: 800 }).catch(() => false)) {
    await span.click();
    await page.waitForTimeout(200);
    return true;
  }
  return false;
}

/**
 * 在编辑器中写入富文本结构：通过工具栏「大标题/小标题/无序列表」+ 键盘输入；加粗用 Ctrl+B。
 */
async function fillRichBody(page, blocks, { skipFirstContentEditable = false } = {}) {
  const editor = await locateBodyEditor(page, { skipFirstContentEditable });
  await editor.click({ timeout: 15_000 });
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);

  for (const block of blocks) {
    if (block.kind === 'h1') {
      await clickToolbarIfVisible(page, /大标题/);
      await page.keyboard.type(block.text, { delay: 15 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
      continue;
    }
    if (block.kind === 'h2') {
      await clickToolbarIfVisible(page, /小标题/);
      await page.keyboard.type(block.text, { delay: 15 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
      continue;
    }
    if (block.kind === 'li') {
      await clickToolbarIfVisible(page, /无序列表|项目符号/);
      await page.keyboard.type(block.text, { delay: 15 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
      continue;
    }
    if (block.kind === 'bold') {
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyB');
      await page.keyboard.up('Control');
      await page.keyboard.type(block.text, { delay: 12 });
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyB');
      await page.keyboard.up('Control');
      await page.waitForTimeout(80);
      continue;
    }
    /* 正文段落 */
    await clickToolbarIfVisible(page, /^正文$|正文格式/);
    await page.keyboard.type(block.text, { delay: 12 });
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
  }
}

async function main() {
  const projectId = Number(process.env.PUBLISH_PROJECT_ID);
  if (!Number.isFinite(projectId) || projectId <= 0) {
    throw new Error('请设置环境变量 PUBLISH_PROJECT_ID 为当前项目的数字 id');
  }

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const shotPath = path.join(SCREENSHOT_DIR, `baijiahao-${ts}.png`);
  const debugDir = SCREENSHOT_DIR;

  const conn = await createDb();
  const article = await pickArticle(conn, projectId, DEFAULT_ARTICLE_STATUS);
  if (!article) {
    await conn.end();
    throw new Error(
      `未找到可发布文章：projectId=${projectId}、status=${DEFAULT_ARTICLE_STATUS}，且内容计划含「百家号」并在计划项中绑定该文章或同选题。可设置 ARTICLE_STATUS 或检查 content_plans / content_plan_items。`,
    );
  }

  log(`选中文章 id=${article.id} title=${article.title}`);

  const titleForBjh = formatBaijiahaoArticleTitle(article.title);
  const blocks = parseMarkdownToBlocks(article.markdownContent || '');
  log(`百家号标题（格式化后）：${titleForBjh}`);
  log(`正文块数量：${blocks.length}`);

  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);

  let publishUrlNote = 'https://baijiahao.baidu.com';

  try {
    await page.goto('https://baijiahao.baidu.com', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    console.log('\n请在浏览器中手动完成百家号登录，登录成功后按回车继续...\n');
    await waitForEnterOnly();

    if (isLoginUrl(page.url())) {
      log('当前 URL 仍包含 /login，等待 30 秒以便完成登录…');
      await page.waitForTimeout(30_000);
    }

    await gotoNewsEditor(page, debugDir, ts);

    const titleInput = await locateTitleField(page, debugDir, ts);
    const titleIsCe = await titleInput
      .evaluate(el => el instanceof HTMLElement && el.isContentEditable)
      .catch(() => false);
    await fillTitleField(titleInput, titleForBjh);

    await fillRichBody(page, blocks, { skipFirstContentEditable: titleIsCe });

    console.log('\n请检查内容是否正确，确认后按回车发布...\n');
    await waitForEnterOnly();

    const publishBtn = page.getByRole('button', { name: /发布|发表/ }).first();
    await publishBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await publishBtn.click();

    const success = page.getByText(/发布成功|提交成功|已发布|审核中/);
    await success.first().waitFor({ state: 'visible', timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const linkHint = await page.locator('a[href*="baijiahao.baidu.com"]').first().getAttribute('href').catch(() => null);
    if (linkHint) publishUrlNote = linkHint;

    await page.screenshot({ path: shotPath, fullPage: true });
    log(`截图已保存：${shotPath}`);

    await markArticlePublished(conn, article.id, publishUrlNote);
    log(`数据库已更新：geo_articles.id=${article.id} → status=已发布 publicPath=${publishUrlNote}`);

    console.log('\n========== 发布结果 ==========');
    console.log(`文章 id: ${article.id}`);
    console.log(`百家号标题: ${titleForBjh}`);
    console.log(`截图: ${shotPath}`);
    console.log(`publicPath: ${publishUrlNote}`);
    console.log('==============================\n');
  } catch (e) {
    await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {});
    log(`出错时已截图（若可）：${shotPath}`);
    throw e;
  } finally {
    await conn.end();
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
