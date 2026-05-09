import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf-8');
const sources = {
  home: read('client/src/pages/Home.tsx'),
  layout: read('client/src/components/DashboardLayout.tsx'),
  app: read('client/src/App.tsx'),
  flow: read('client/src/pages/V12FlowPages.tsx'),
  guide: read('client/src/components/GeoStatusGuide.tsx'),
  assets: read('client/src/pages/AssetCenter.tsx'),
};

const failures = [];
const assertContains = (name, source, expected) => {
  if (!source.includes(expected)) failures.push(`${name} 缺少：${expected}`);
};
const assertNotContains = (name, source, forbidden) => {
  if (source.includes(forbidden)) failures.push(`${name} 不应出现：${forbidden}`);
};

assertContains('首页', sources.home, 'AI GEO 增长工作台');
assertContains('首页', sources.home, '建档、诊断、内容、发布、监测、报告');
assertContains('首页', sources.home, '6 步进度条');
assertContains('首页', sources.home, '继续下一步');

for (const item of ['总览', '企业档案', 'AI 诊断', '内容生成', '内容发布', '收录监测', '交付报告']) {
  assertContains('左侧导航', sources.layout, `label: "${item}"`);
  assertContains('状态引导条或流程页', sources.guide + sources.home + sources.assets + sources.flow, item);
}
for (const item of ['内容策略', '平台优先级', '事实溯源', '一致性检查', '发布前检查', '第三方素材', 'AI 可引用片段', '内容增长流水线', '平台发布', '报告中心', '工作台', 'AI训练', '账号管理', 'AI创作', '自动化发布', '收录排名', '付费投稿']) {
  assertNotContains('左侧一级菜单', sources.layout, `label: "${item}"`);
}

for (const item of ['当前阶段', '完成度', '下一步动作', '为什么要做', '风险提醒']) {
  assertContains('状态引导条组件', sources.guide, item);
}
for (const item of ['企业基础资料', '产品服务资料', '客户案例', '竞品资料', '合规规则', '发布策略', '当前页面只保留一个主动作']) {
  assertContains('企业档案页', sources.assets, item);
}
for (const item of ['客户问题', 'AI 回答', '诊断结果', '内容缺口', '下一步建议']) {
  assertContains('AI 诊断页', sources.flow, item);
}
for (const item of ['竞品对比文章', '产品能力说明文章', '行业选型 / FAQ 文章', '发布准入', '阻断原因']) {
  assertContains('内容生成页', sources.flow, item);
}
for (const item of ['可发布内容', '已发布内容', '第三方平台素材', '当前只生成可复制素材', '不自动登录第三方平台']) {
  assertContains('内容发布页', sources.flow, item);
}
for (const item of ['已发布内容监测卡片', '收录', 'AI 提及', 'AI 推荐', '最近检测时间', '当前建议', '监测结果来自有限样本']) {
  assertContains('收录监测页', sources.flow, item);
}
for (const item of ['GEO 诊断报告', '内容生产报告', '发布监测报告', '复测优化报告', '风险说明']) {
  assertContains('交付报告页', sources.flow, item);
}

const placeholderPattern = /\b(Lorem|Ipsum|TODO placeholder|Coming Soon|coming soon|Untitled|New Project|Dashboard)\b/;
for (const [name, source] of Object.entries(sources)) {
  const match = source.match(placeholderPattern);
  if (match) failures.push(`${name} 存在英文占位符：${match[0]}`);
}

if (failures.length > 0) {
  console.error('V1.2 UI 硬验收失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('V1.2 UI 硬验收通过：首页、七个一级入口、六步流程页面、状态引导条与中文占位检查均通过。');
