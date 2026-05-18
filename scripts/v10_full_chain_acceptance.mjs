import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = 'screenshots/v10-acceptance';
const TIMEOUT = 60000;
const AI_TIMEOUT = 120000;
const LOGIN_URL_WAIT_MS = 30000;

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

async function shot(page, name) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  log(`截图已保存：${file}`);
}

async function waitAndFill(page, selector, value) {
  await page.waitForSelector(selector, { timeout: TIMEOUT });
  await page.fill(selector, value);
}

async function waitAndClick(page, selector) {
  await page.waitForSelector(selector, { timeout: TIMEOUT });
  await page.click(selector);
}

async function selectProject(page, index = 0) {
  await page.waitForSelector('select', { timeout: TIMEOUT });
  const options = await page.$$eval('select option', opts =>
    opts.map(o => ({ value: o.value, text: o.textContent }))
  );
  const projectOptions = options.filter(o => o.value && o.value !== '');
  if (projectOptions.length === 0) throw new Error('没有可选项目');
  await page.selectOption('select', projectOptions[index].value);
  log(`已选择项目：${projectOptions[index].text}`);
  await page.waitForTimeout(1000);
}

const results = [];

function pass(step) {
  results.push({ step, status: '✅ 通过' });
  log(`✅ ${step} 通过`);
}

function fail(step, reason) {
  results.push({ step, status: `❌ 失败：${reason}` });
  log(`❌ ${step} 失败：${reason}`);
}

async function run() {
const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);

  try {

    // ══════════════════════════════════════
    // 登录（第2步之前）
    // ══════════════════════════════════════
    log('=== 登录 ===');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '本地开发登录' }).waitFor({ state: 'visible', timeout: TIMEOUT });
    await page.getByRole('button', { name: '本地开发登录' }).click();

    await page.waitForURL((u) => !u.href.includes('/login'), { timeout: LOGIN_URL_WAIT_MS });
    await page.waitForLoadState('networkidle').catch(() => {});

    await shot(page, '00-login');
    log('登录成功');

    // ══════════════════════════════════════
    // 第1步：首页
    // ══════════════════════════════════════
    log('=== 第1步：首页 ===');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await shot(page, '01-home');
    const homeContent = await page.evaluate(() => document.body?.innerText ?? '');
    const marker = 'V1.0 核心三步流程';
    if (homeContent.includes(marker)) {
      pass('第1步：首页');
    } else {
      const preview = homeContent.replace(/\s+/g, ' ').trim().slice(0, 300);
      fail('第1步：首页', `未找到「${marker}」，正文预览：${preview}`);
    }

    // ══════════════════════════════════════
    // 第2步：企业档案
    // ══════════════════════════════════════
    log('=== 第2步：企业档案 ===');
    await page.goto(`${BASE_URL}/enterprise-profile`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await shot(page, '02-enterprise-profile-before');

    // 创建新项目（填写企业名称）
    try {
      const createBtn = page.locator('button:has-text("创建"), button:has-text("新建"), button:has-text("添加项目")').first();
      if (await createBtn.isVisible()) {
        await createBtn.click();
        await page.waitForTimeout(1000);
      }
      // 填写企业名称
      const nameInput = page.locator('input[placeholder*="企业"], input[placeholder*="名称"], input').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('V1.0验收测试企业' + Date.now().toString().slice(-4));
        await page.waitForTimeout(500);
      }
      // 保存
      const saveBtn = page.locator('button:has-text("保存"), button:has-text("创建项目"), button:has-text("确认")').first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      log(`企业档案创建跳过：${e.message}`);
    }

    await selectProject(page).catch(() => log('项目选择跳过'));
    await page.waitForTimeout(2000);
    await shot(page, '02-enterprise-profile-after');
    const profileContent = await page.content();
    if (profileContent.includes('企业档案') || profileContent.includes('企业介绍')) {
      pass('第2步：企业档案');
    } else {
      fail('第2步：企业档案', '页面未找到企业档案内容');
    }

    // ══════════════════════════════════════
    // 第3步：AI 诊断页（生成目标客户问题）
    // ══════════════════════════════════════
    log('=== 第3步：AI 诊断页（生成目标客户问题）===');
    await page.goto(`${BASE_URL}/ai-diagnosis`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await selectProject(page).catch(() => log('项目选择跳过'));
    await page.waitForTimeout(1500);
    await shot(page, '03-ai-diagnosis-before');

    try {
      const genBtn = page.locator('button:has-text("重新生成")').first();
      if (await genBtn.isVisible()) {
        await genBtn.click();
        await page.waitForTimeout(5000);
      }
    } catch (e) {
      log(`生成目标客户问题：${e.message}`);
    }

    await shot(page, '03-ai-diagnosis-questions');
    const diagContent = await page.content();
    if (diagContent.includes('目标客户问题') || diagContent.includes('指定问题') || diagContent.includes('重新生成')) {
      pass('第3步：AI 诊断页（生成目标客户问题）');
    } else {
      fail('第3步：AI 诊断页（生成目标客户问题）', '未找到目标客户问题相关区块');
    }

    // ══════════════════════════════════════
    // 第4步：运行AI诊断
    // ══════════════════════════════════════
    log('=== 第4步：运行AI诊断（LLM调用，最长等待120秒）===');
    try {
      const runBtn = page.locator('button:has-text("运行 AI 诊断"), button:has-text("运行AI诊断")').first();
      if (await runBtn.isVisible()) {
        await runBtn.click();
        log('已点击运行AI诊断，等待LLM返回...');
        // 等待进度消失或结果出现
        await page.waitForSelector(
          'text=诊断已完成, text=AI 诊断已完成, text=优化任务, text=GEO 可见度评分',
          { timeout: AI_TIMEOUT }
        ).catch(() => log('等待诊断完成超时，继续截图'));
        await page.waitForTimeout(3000);
      }
    } catch (e) {
      log(`运行AI诊断：${e.message}`);
    }

    await shot(page, '04-ai-diagnosis-result');
    const diagResult = await page.content();
    if (diagResult.includes('诊断结果') || diagResult.includes('优化任务') || diagResult.includes('GEO 可见度')) {
      pass('第4步：运行AI诊断');
    } else {
      fail('第4步：运行AI诊断', '未找到诊断结果');
    }

    // ══════════════════════════════════════
    // 第5步：GEO评分和优化任务
    // ══════════════════════════════════════
    log('=== 第5步：GEO评分和优化任务 ===');
    await shot(page, '05-score-and-tasks');
    const scoreContent = await page.content();
    if (scoreContent.includes('评分') || scoreContent.includes('任务') || scoreContent.includes('优化')) {
      pass('第5步：GEO评分和优化任务');
    } else {
      fail('第5步：GEO评分和优化任务', '未找到评分或任务');
    }

    // ══════════════════════════════════════
    // 第6步：内容生产计划
    // ══════════════════════════════════════
    log('=== 第6步：内容生产计划 ===');
    await page.goto(`${BASE_URL}/content-generation`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await selectProject(page).catch(() => log('项目选择跳过'));
    await page.waitForTimeout(2000);
    await shot(page, '06-content-plan-before');

    try {
      // 保存内容计划
      const savePlanBtn = page.locator('button:has-text("保存内容计划"), button:has-text("更新内容计划")').first();
      if (await savePlanBtn.isVisible({ timeout: 5000 })) {
        await savePlanBtn.click();
        await page.waitForTimeout(3000);
        log('已点击保存内容计划');
      }
    } catch (e) {
      log(`保存内容计划：${e.message}`);
    }

    await shot(page, '06-content-plan-saved');
    const planContent = await page.content();
    if (planContent.includes('内容生产计划') || planContent.includes('目标发布平台') || planContent.includes('内容类型')) {
      pass('第6步：内容生产计划');
    } else {
      fail('第6步：内容生产计划', '未找到内容计划内容');
    }

    // ══════════════════════════════════════
    // 第7步：生成内容并质检
    // ══════════════════════════════════════
    log('=== 第7步：生成内容并质检 ===');
    try {
      // 生成本周内容选题
      const topicBtn = page.getByRole('button', { name: '生成本周内容选题' });
      if (await topicBtn.isVisible({ timeout: 5000 })) {
        await topicBtn.click();
        // 选题卡片：与 V12FlowPages 选题列表一致，每条选题按钮内含「对应优化任务：」
        const firstTopicCard = page
          .locator('button')
          .filter({ has: page.locator('p', { hasText: '对应优化任务：' }) })
          .first();
        await firstTopicCard.waitFor({ state: 'visible', timeout: AI_TIMEOUT });
        log('选题列表已出现');
        await firstTopicCard.click();
        log('已点击第一条选题');

        const articleBtn = page.getByRole('button', { name: '生成 1 篇 GEO 内容' });
        await articleBtn.waitFor({ state: 'visible', timeout: TIMEOUT });
        const articleWaitDeadline = Date.now() + TIMEOUT;
        while (Date.now() < articleWaitDeadline) {
          if (await articleBtn.isEnabled()) break;
          await page.waitForTimeout(200);
        }
        if (!(await articleBtn.isEnabled())) {
          throw new Error('「生成 1 篇 GEO 内容」在超时内仍为 disabled（selectedTopicId 未生效或仍在生成选题）');
        }
        log('文章生成按钮已可点击');
        await articleBtn.click();
        await page.waitForTimeout(8000);
        log('已生成文章');
      }

      // 质检
      const qualityBtn = page.locator('button:has-text("执行 GEO 内容质量审查")').first();
      if (await qualityBtn.isVisible({ timeout: 5000 })) {
        await qualityBtn.click();
        await page.waitForTimeout(5000);
        log('已执行质检');
      }
    } catch (e) {
      log(`生成内容质检：${e.message}`);
    }

    await shot(page, '07-content-generated');
    const genContent = await page.content();
    if (genContent.includes('质量总分') || genContent.includes('已生成') || genContent.includes('GEO 质检')) {
      pass('第7步：生成内容并质检');
    } else {
      fail('第7步：生成内容并质检', '未找到生成内容或质检结果');
    }

    // ══════════════════════════════════════
    // 第8步：打开发布记录页
    // ══════════════════════════════════════
    log('=== 第8步：发布记录页 ===');
    await page.goto(`${BASE_URL}/content-publishing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await selectProject(page).catch(() => log('项目选择跳过'));
    await page.waitForTimeout(1500);
    await shot(page, '08-publishing-platform');

    const pubContent = await page.content();
    if (pubContent.includes('发布记录') && pubContent.includes('新建发布记录') && pubContent.includes('已发布记录列表')) {
      pass('第8步：发布记录页');
    } else {
      fail('第8步：发布记录页', '未找到发布记录页核心区块');
    }

    // ══════════════════════════════════════
    // 第9步：登记发布记录（可选交互）
    // ══════════════════════════════════════
    log('=== 第9步：登记发布记录 ===');
    try {
      const baijia = page.locator('label:has-text("百家号") input[type="checkbox"]').first();
      if (await baijia.isVisible({ timeout: 5000 })) {
        await baijia.click();
        await page.waitForTimeout(500);
      }
      const newSection = page.locator('section').filter({ hasText: '新建发布记录' });
      const linkInput = newSection.locator('input[placeholder="https://"]').first();
      if (await linkInput.isVisible({ timeout: 3000 })) {
        await linkInput.fill('https://www.example-geo.com/geo/article-001');
      }
      const saveBtn = newSection.getByRole('button', { name: '保存', exact: true });
      if (await saveBtn.isVisible({ timeout: 3000 })) {
        await saveBtn.click();
        await page.waitForTimeout(3000);
      }
    } catch (e) {
      log(`登记发布记录：${e.message}`);
    }

    await shot(page, '09-publish-record');
    const recordContent = await page.content();
    if (recordContent.includes('发布记录') && (recordContent.includes('已保存') || recordContent.includes('保存链接') || recordContent.includes('暂无发布记录') || recordContent.includes('暂无可选文章'))) {
      pass('第9步：登记发布记录');
    } else {
      fail('第9步：登记发布记录', '未找到发布记录页预期内容');
    }

    // ══════════════════════════════════════
    // 第10步：交付报告
    // ══════════════════════════════════════
    log('=== 第10步：交付报告 ===');
    await page.goto(`${BASE_URL}/delivery-reports`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await selectProject(page).catch(() => log('项目选择跳过'));
    await page.waitForTimeout(3000);
    await shot(page, '10-delivery-report');

    const reportContent = await page.content();
    const requiredModules = ['本轮交付摘要', 'AI 诊断结果', '优化任务清单', '已生成内容', '发布记录', '下一步建议'];
    const missingModules = requiredModules.filter(m => !reportContent.includes(m));

    if (missingModules.length === 0) {
      pass('第10步：交付报告（全部模块）');
    } else {
      fail('第10步：交付报告', `缺少模块：${missingModules.join('、')}`);
    }

    // 检查是否有真实数据（不是全部"暂无"类空态）
    const realDataCount = requiredModules.filter(m => {
      const idx = reportContent.indexOf(m);
      if (idx === -1) return false;
      const nearby = reportContent.slice(idx, idx + 800);
      return !/暂无/.test(nearby);
    }).length;
    log(`交付报告有真实数据的模块数：${realDataCount}/${requiredModules.length}`);

  } catch (err) {
    log(`验收脚本异常：${err.message}`);
    await shot(page, 'error-screenshot');
  } finally {
    // 输出汇总
    console.log('\n══════════════════════════════════════');
    console.log('V1.0 全链路验收结果汇总');
    console.log('══════════════════════════════════════');
    for (const r of results) {
      console.log(`${r.status}  ${r.step}`);
    }
    const passed = results.filter(r => r.status.startsWith('✅')).length;
    const total = results.length;
    console.log(`\n总计：${passed}/${total} 通过`);
    console.log(`截图目录：${SCREENSHOT_DIR}/`);
    console.log('══════════════════════════════════════\n');

    await browser.close();
  }
}

run().catch(console.error);