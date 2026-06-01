import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  WEEKLY_CONTENT_PAGE_LABELS,
  WEEKLY_CONTENT_PAGE_SOURCE_SEGMENT_MARKERS,
} from './lib/weeklyContentPageLabels.mjs';

const root = resolve(process.cwd());
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf-8');
const sources = {
  home: read('client/src/components/V1WorkbenchOverview.tsx'),
  layout: read('client/src/components/DashboardLayout.tsx'),
  app: read('client/src/App.tsx'),
  share: read('client/src/pages/DeliveryReportSharePage.tsx'),
  customerView: read('client/src/components/DeliveryReportCustomerView.tsx'),
  publicShare: read('client/src/pages/DeliveryReportPublicPage.tsx'),
  publicEvidence: read('client/src/pages/DeliveryReportPublicEvidencePage.tsx'),
  evidenceView: read('client/src/components/AiSearchEvidenceView.tsx'),
  flow: read('client/src/pages/V12FlowPages.tsx'),
  weekly: read('client/src/pages/WeeklyContentPage.tsx'),
  guide: read('client/src/components/GeoStatusGuide.tsx'),
  assets:
    read('client/src/pages/AssetCenter.tsx') +
    read('client/src/components/enterpriseProfile/FiveMinuteBasicOnboardingSection.tsx') +
    read('client/src/components/enterpriseProfile/ProfileUploadAssistSection.tsx') +
    read('client/src/components/enterpriseProfile/EnterprisePublishEnvironmentSection.tsx') +
    read('client/src/components/enterpriseProfile/AdvancedMaterialsSection.tsx') +
    read('client/src/components/enterpriseProfile/CustomerCaseLibrarySection.tsx') +
    read('client/src/components/enterpriseProfile/GeoMaterialPreviewSection.tsx'),
};

const failures = [];
const assertContains = (name, source, expected) => {
  if (!source.includes(expected)) failures.push(`${name} 缺少：${expected}`);
};
const assertNotContains = (name, source, forbidden) => {
  if (source.includes(forbidden)) failures.push(`${name} 不应出现：${forbidden}`);
};

assertContains('首页', sources.home, 'AI 搜索增长总览');
assertContains('首页', sources.home, '查看品牌在 AI 搜索中的可见度');
assertContains('首页', sources.home, '下一步动作');
assertContains('首页', sources.home, '最近发布');
assertContains('首页', sources.home, '品牌提及率');
assertContains('首页', sources.home, 'AiPageShell');

for (const item of [
  '企业项目',
  '项目工作台',
  '品牌资产建档',
  'AI 实测诊断',
  '平台化内容资产',
  '平台适配发布',
  '收录监测',
  '交付报告',
]) {
  assertContains('左侧导航', sources.layout, `label: "${item}"`);
}
assertContains('左侧导航', sources.layout, 'AI 搜索增长系统');
assertContains('左侧导航', sources.layout, 'path: "/workspace"');
for (const item of [
  '总览',
  '内容生成',
  '内容发布',
  '内容策略',
  '平台优先级',
  '事实溯源',
  '一致性检查',
  '发布前检查',
  '第三方素材',
  'AI 可引用片段',
  '内容增长流水线',
  '报告中心',
  'AI训练',
  '账号管理',
  'AI创作',
  '自动化发布',
  '收录排名',
  '付费投稿',
  '资产进展看板',
  'AI 内容诊断',
  '内容资产生产',
  '资产发布记录',
  '客户交付报告',
  '企业档案',
]) {
  assertNotContains('左侧一级菜单', sources.layout, `label: "${item}"`);
}

for (const item of ['V1.0 核心三步流程', '关键产物入口', 'GEO 可见度', '推演', '资产库']) {
  assertNotContains('首页', sources.home, item);
}

for (const item of ['当前阶段', '完成度', '下一步动作', '为什么要做', '风险提醒']) {
  assertContains('状态引导条组件', sources.guide, item);
}
for (const item of [
  '品牌资产建档',
  '保存并开始 AI 实测诊断',
  'FiveMinuteBasicOnboardingSection',
  'ProfileAiUnderstandingPreview',
  'ProfileUploadAssistSection',
  'AdvancedMaterialsSection',
  'enterprise-profile-page',
]) {
  assertContains('企业档案页', sources.assets, item);
}
assertNotContains('企业档案页', sources.assets, 'Section 1 · 基本身份');
for (const item of ['先新建第一个企业项目', '新增企业项目', 'geo.projects.create', 'handleCreateProject']) {
  assertNotContains('企业档案页', sources.assets, item);
}
assertContains('客户管理台', read('client/src/pages/ClientDashboardPage.tsx'), '企业项目');
assertContains('客户管理台', read('client/src/pages/ClientDashboardPage.tsx'), '新建企业项目');
for (const forbidden of ['ownerUserId', 'taskId', 'projectId=', 'data-testid="project-id"']) {
  assertNotContains('客户管理台', read('client/src/pages/ClientDashboardPage.tsx'), forbidden);
}
assertContains('企业项目壳层', read('client/src/components/DashboardLayout.tsx'), 'EnterpriseProjectShell');
assertContains('/clients 独立布局', read('client/src/components/DashboardLayout.tsx'), 'clients-hub-main');
assertContains('/clients 独立布局', read('client/src/components/DashboardLayout.tsx'), 'isClientsHub');
assertNotContains('/clients 隐藏侧栏', read('client/src/components/DashboardLayout.tsx'), 'label: "资产进展看板"');
assertContains('企业项目壳层', read('client/src/components/project/ProjectWorkspaceTopBar.tsx'), 'project-workspace-top-bar');
assertContains('企业项目壳层', read('client/src/components/project/ProjectNextActionPanel.tsx'), 'project-next-action-panel');
for (const item of [
  'AI 内容诊断',
  '内容诊断',
  '目标客户问题',
  '重新生成',
  '诊断结果',
  '内容缺口',
  '内容覆盖评分',
  '优化任务',
  '核心诊断结论',
  '完整诊断明细',
  '诊断流程控制台',
  '去生成内容资产',
  '开始 AI 内容诊断',
]) {
  assertContains('AI 诊断页', sources.flow, item);
}
for (const item of ['问题文本 questionText', 'AI 平台 aiPlatform', '原始回答 rawAnswer', 'analysis_results']) {
  assertNotContains('AI 诊断页', sources.flow, item);
}
for (const item of WEEKLY_CONTENT_PAGE_LABELS) {
  assertContains('内容资产生产页', sources.weekly, item);
}
for (const item of WEEKLY_CONTENT_PAGE_SOURCE_SEGMENT_MARKERS) {
  assertContains('内容资产生产页', sources.weekly, item);
}
assertContains('App 路由', sources.app, 'WeeklyContentPage');
assertContains('App 路由', sources.app, 'path="/weekly"');
const publishPage =
  read('client/src/pages/ContentPublishingCenterPage.tsx') +
  read('client/src/components/publishing/PublishTaskColumnBoard.tsx') +
  read('client/src/components/publishing/LocalAgentStatusCard.tsx');
for (const item of [
  '平台适配发布',
  'publish-center-page',
  'local-agent-status-card',
  'publish-task-columns',
  'createManualPublishRecord',
  'updateManualPublishRecord',
  'publish-retest-rewrite-fold',
]) {
  assertContains('发布中心页', publishPage, item);
}
for (const item of ['连接发布平台', '可由交付人员配置', '风险边界', '支持方式', 'browser-extension.zip', '下载 Chrome 插件']) {
  assertNotContains('发布中心页', publishPage, item);
}
for (const item of ['已创建的监测卡片', '收录', 'AI 提及', 'AI 推荐', '最近检测：', '当前建议', '监测结果来自有限样本']) {
  assertContains('收录监测页', sources.flow, item);
}
const deliveryReportPage =
  read('client/src/pages/DeliveryReportsCenterPage.tsx') +
  read('client/src/lib/deliveryReportProductDisplay.ts');
const deliveryReportPages = deliveryReportPage + sources.customerView;
for (const item of [
  'GEO 实验型交付报告',
  'delivery-report-page',
  '一句话经营结论',
  '本轮完成事项',
  '发布内容清单',
  '生成下一轮内容计划',
]) {
  assertContains('交付报告页', deliveryReportPage, item);
}
for (const item of ['不承诺保证收录、排名或 AI 推荐', '当前数据不足，完成发布后复测后将生成本轮 GEO 增长结论。']) {
  assertContains('交付报告页', deliveryReportPages, item);
}
assertContains('App 路由', sources.app, 'path="/delivery-reports/share/:projectId"');
assertContains('App 路由', sources.app, 'path="/delivery-reports/public/:token"');
assertContains('App 路由', sources.app, 'path="/delivery-reports/public/:token/evidence/:monitoringId/:resultIndex"');
for (const item of ['复制客户报告链接', 'createShareLink', 'disableShareLink', 'regenerateShareLink', 'sharePath', 'delivery-report-share-fold']) {
  assertContains('交付报告页', deliveryReportPage, item);
}
assertContains('交付报告页', deliveryReportPage, '确定要禁用当前客户报告链接吗？');
assertContains('交付报告页', deliveryReportPage, '确定要重新生成客户报告链接吗？');
assertContains('交付报告页', deliveryReportPage, 'window.confirm');
const copyToastLine =
  deliveryReportPage.match(/toast\.success\([^)]*客户报告链接已复制[^)]*\)/)?.[0] ?? '';
if (!copyToastLine) failures.push('交付报告页 缺少：复制链接成功 toast');
for (const forbidden of ['shareToken', 'migration', 'rawAnswer']) {
  assertNotContains('复制链接成功提示', copyToastLine, forbidden);
}
assertContains('交付报告页', deliveryReportPage, '生成分享链接');
assertContains('交付报告页', deliveryReportPage, 'delivery-report-share-primary');
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
for (const item of ['AI 搜索可见度评分', '经营结论', '本轮报告摘要', 'AI 搜索实测结果', '发布前后变化', '本轮新增 AI 搜索资产', '下一轮优化动作', '查看完整证据', '查看证据', '查看文章', '本轮暂无发布记录']) {
  assertContains('客户查看页', customerPages, item);
}
assertContains('匿名分享类型', read('shared/deliveryReportPublicShare.ts'), 'publishedContent');
for (const item of ['rawAnswer', 'taskId', 'provider', 'mock', 'schema', 'testStage', 'aiTestResults']) {
  assertNotContains('客户查看页', sources.publicShare + sources.customerView, item);
}

const globalScanPages = {
  clients: read('client/src/pages/ClientDashboardPage.tsx'),
  workspace: read('client/src/pages/EnterpriseWorkspacePage.tsx'),
  profile: read('client/src/pages/AssetCenter.tsx'),
  weekly: sources.weekly,
  publish: publishPage,
  delivery: deliveryReportPage,
};
for (const [name, source] of Object.entries(globalScanPages)) {
  for (const forbidden of [
    'ownerUserId',
    'rawAnswer',
    'provider',
    'adapter',
    'mock',
    'JSON.stringify',
    'workspaceStage',
    '下载 Chrome 插件',
    'browser-extension.zip',
    '任务 #',
    '当前企业：',
    'BusinessPageProjectHeader',
    'localProfileId?.slice',
    'localAgentId?.slice',
    '>projectId<',
    'data-testid="project-id"',
  ]) {
    assertNotContains(`全局扫描 ${name}`, source, forbidden);
  }
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
