import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf-8');
const sources = {
  home: read('client/src/pages/Home.tsx'),
  layout: read('client/src/components/DashboardLayout.tsx'),
  app: read('client/src/App.tsx'),
  geoPages: read('client/src/pages/GeoPages.tsx'),
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

assertContains('首页', sources.home, 'AI GEO 增长中枢');
assertContains('首页', sources.home, '企业资产 → AI 诊断 → 内容生产 → 平台发布 → 收录监测 → 再优化');

for (const item of ['总览指挥舱', '企业资产', 'AI 诊断', '内容策略', '内容生产', '平台发布', '收录监测', '报告中心']) {
  assertContains('左侧导航', sources.layout, `label: "${item}"`);
  assertContains('状态引导条', sources.guide + sources.home + sources.assets + sources.geoPages, item);
}
for (const item of ['工作台', 'AI训练', '账号管理', 'AI创作', '自动化发布', '收录排名', '付费投稿']) {
  assertNotContains('左侧一级菜单', sources.layout, `label: "${item}"`);
}

for (const item of ['当前阶段', '当前完成度', '下一步动作', '为什么要做', '风险提醒']) {
  assertContains('状态引导条组件', sources.guide, item);
}
assertContains('状态引导条组件', sources.guide, '开始补充企业资料');
assertContains('企业资产页', sources.assets, '企业 GEO 资产尚未建立');
assertContains('企业资产页', sources.assets, '系统需要先了解企业资料，才能生成准确、可溯源、高质量的 GEO 内容。');
assertContains('企业资产页', sources.assets, '上传资料文档');
assertContains('企业资产页', sources.assets, '资料不足时，系统不得编造案例、数据、价格和效果承诺。');

for (const item of ['内容机会池', '文章列表', 'GEO 内容质量评分', '生成依据', '是否允许发布', '90 分以上：优质 GEO 内容，可优先发布', '80-89 分：建议优化后发布', '80 分以下：禁止发布']) {
  assertContains('内容生产页', sources.geoPages, item);
}
for (const item of ['第一优先级平台', '第二优先级平台', '不建议平台', '推荐原因', '适合内容形式', '发布注意事项', '复测指标', '第三方平台当前只生成素材，不自动登录发布']) {
  assertContains('平台发布页', sources.geoPages, item);
}
for (const item of ['AI 收录雷达', '已发布内容', '已收录内容', '未收录内容', 'AI 已提及内容', 'AI 已推荐内容', '待优化内容', 'AI 提及状态', 'AI 推荐状态', '重写标题', '增强摘要', '增加 FAQ', '重新发布', '进入下一轮复测']) {
  assertContains('收录监测页', sources.geoPages, item);
}
assertContains('报告中心', sources.geoPages, '客户交付报告');

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

console.log('V1.2 UI 硬验收通过：首页、客户路径菜单、状态引导条、内容生产、平台发布、收录监测、报告中心与中文占位检查均通过。');
