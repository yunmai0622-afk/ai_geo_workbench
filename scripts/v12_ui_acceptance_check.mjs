import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf-8');
const sources = {
  home: read('client/src/pages/Home.tsx') + read('client/src/components/V1WorkbenchOverview.tsx'),
  layout: read('client/src/components/DashboardLayout.tsx'),
  app: read('client/src/App.tsx'),
  share: read('client/src/pages/DeliveryReportSharePage.tsx'),
  customerView: read('client/src/components/DeliveryReportCustomerView.tsx'),
  publicShare: read('client/src/pages/DeliveryReportPublicPage.tsx'),
  publicEvidence: read('client/src/pages/DeliveryReportPublicEvidencePage.tsx'),
  evidenceView: read('client/src/components/AiSearchEvidenceView.tsx'),
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

assertContains('首页', sources.home, '企业 AI 搜索增长工作台');
assertContains('首页', sources.home, '今日概览与本周任务');
assertContains('首页', sources.home, '本周内容任务');
assertContains('首页', sources.home, '最近发布');
assertContains('首页', sources.home, '内容诊断');
assertContains('首页', sources.home, '累计发布篇数');

for (const item of ['工作台', '我的信息', '内容诊断', '本周内容', '发布记录', '内容进展', '效果报告']) {
  assertContains('左侧导航', sources.layout, `label: "${item}"`);
}
for (const item of ['总览', '内容生成', '内容发布', '收录监测', '内容策略', '平台优先级', '事实溯源', '一致性检查', '发布前检查', '第三方素材', 'AI 可引用片段', '内容增长流水线', '报告中心', 'AI训练', '账号管理', 'AI创作', '自动化发布', '收录排名', '付费投稿']) {
  assertNotContains('左侧一级菜单', sources.layout, `label: "${item}"`);
}

for (const item of ['V1.0 核心三步流程', '关键产物入口', 'GEO 可见度', '推演', '资产库']) {
  assertNotContains('首页', sources.home, item);
}

for (const item of ['当前阶段', '完成度', '下一步动作', '为什么要做', '风险提醒']) {
  assertContains('状态引导条组件', sources.guide, item);
}
for (const item of ['企业档案', 'Section 1 · 基本身份', 'Section 2 · 你的客户', 'Section 3 · 有什么证明', '保存基本身份', '保存客户信息', '资料完整度']) {
  assertContains('企业档案页', sources.assets, item);
}
for (const item of ['内容诊断', '目标客户问题', '重新生成', '诊断结果', '内容缺口', '内容覆盖评分', '优化任务', '进入内容生产']) {
  assertContains('AI 诊断页', sources.flow, item);
}
for (const item of ['问题文本 questionText', 'AI 平台 aiPlatform', '原始回答 rawAnswer', 'analysis_results']) {
  assertNotContains('AI 诊断页', sources.flow, item);
}
for (const item of ['内容生产计划', '本步骤用于根据 内容诊断结果和优化任务，制定本周内容计划', '保存内容计划', '生成本周内容选题', '进入发布记录']) {
  assertContains('内容生成页', sources.flow, item);
}
for (const item of ['发布记录', '新建发布记录', '已发布记录列表', '选择文章', '选择平台（多选）', '保存链接', 'createManualPublishRecord', 'updateManualPublishRecord', 'publishRecords']) {
  assertContains('发布记录页', sources.flow, item);
}
for (const item of ['连接发布平台', '可由交付人员配置', '风险边界', '支持方式']) {
  assertNotContains('发布记录页', sources.flow, item);
}
for (const item of ['已发布内容监测卡片', '收录', 'AI 提及', 'AI 推荐', '最近检测时间', '当前建议', '监测结果来自有限样本']) {
  assertContains('收录监测页', sources.flow, item);
}
const deliveryReportPages = sources.flow + sources.customerView;
for (const item of ['DeliveryReportCustomerView', '内容诊断结果', '优化任务清单', '已生成内容']) {
  assertContains('交付报告页', sources.flow, item);
}
for (const item of ['AI 搜索可见度评分', '不承诺保证收录、排名或 AI 推荐']) {
  assertContains('交付报告页', deliveryReportPages, item);
}
assertContains('App 路由', sources.app, 'path="/delivery-reports/share/:projectId"');
assertContains('App 路由', sources.app, 'path="/delivery-reports/public/:token"');
assertContains('App 路由', sources.app, 'path="/delivery-reports/public/:token/evidence/:monitoringId/:resultIndex"');
for (const item of ['复制客户报告链接', '重新生成客户报告链接', '禁用客户报告链接', 'createShareLink', 'disableShareLink', 'regenerateShareLink', 'sharePath']) {
  assertContains('交付报告页', sources.flow, item);
}
assertContains('交付报告页', sources.flow, '新的客户报告链接已生成并复制');
assertContains('交付报告页', sources.flow, '客户报告链接已禁用，原链接将无法访问');
assertContains('交付报告页', sources.flow, '确定要禁用当前客户报告链接吗？');
assertContains('交付报告页', sources.flow, '确定要重新生成客户报告链接吗？');
assertContains('交付报告页', sources.flow, 'window.confirm');
assertContains('交付报告页', sources.flow, '客户报告链接已复制。该链接长期有效，请仅发送给对应客户');
const copyToastLine =
  sources.flow.match(/toast\.success\("客户报告链接已复制[^"]*"\)/)?.[0] ?? '';
if (!copyToastLine) failures.push('交付报告页 缺少：复制链接成功 toast');
for (const item of ['长期有效', '仅发送给对应客户']) {
  assertContains('复制链接成功提示', copyToastLine, item);
}
for (const forbidden of ['shareToken', 'projectId', 'migration', 'rawAnswer']) {
  assertNotContains('复制链接成功提示', copyToastLine, forbidden);
}
assertContains('部署说明', read('HARNESS.md'), '0019_delivery_report_share_tokens');
assertContains('部署说明', read('HARNESS.md'), 'pnpm db:push');
assertContains('匿名分享文案', read('shared/deliveryReportPublicShare.ts'), '报告链接无效或已失效，请联系服务人员重新获取');
assertContains('匿名分享文案', read('shared/deliveryReportPublicShare.ts'), '证据链接无效或已失效，请联系服务人员重新获取');
assertContains('匿名客户报告页', sources.publicShare, 'buildDeliveryReportPublicEvidencePath');
assertNotContains('匿名客户报告页', sources.publicShare, '/geo/evidence/');
assertContains('匿名证据页', sources.publicEvidence + sources.evidenceView, 'AI 搜索实测证据');
assertContains('匿名证据页', sources.evidenceView, 'AI 原始回答');
assertNotContains('匿名证据展示', sources.evidenceView + sources.publicEvidence, 'rawAnswer');
assertContains('共享路径', read('shared/deliveryReportPublicShare.ts'), '/delivery-reports/public/');
const customerPages = sources.share + sources.customerView + sources.publicShare;
for (const item of ['AI 搜索可见度评分', 'AI 搜索实测结果', '本轮发布内容', '下一步建议', '查看完整证据', '查看证据', '查看文章', '本轮暂无发布记录']) {
  assertContains('客户查看页', customerPages, item);
}
assertContains('匿名分享类型', read('shared/deliveryReportPublicShare.ts'), 'publishedContent');
for (const item of ['rawAnswer', 'taskId', 'provider', 'mock', 'schema', 'testStage', 'aiTestResults']) {
  assertNotContains('客户查看页', sources.publicShare + sources.customerView, item);
}

const placeholderPattern = /\b(Lorem|Ipsum|TODO placeholder|Coming Soon|coming soon|Untitled|New Project|Dashboard)\b/;
for (const [name, source] of Object.entries(sources)) {
  const match = source.match(placeholderPattern);
  if (match) failures.push(`${name} 存在英文占位符：${match[0]}`);
}

if (failures.length > 0) {
  console.error('V1.0 UI 硬验收失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('V1.0 UI 硬验收通过：首页、六个一级入口、核心三步流程、状态引导条与中文占位检查均通过。');
