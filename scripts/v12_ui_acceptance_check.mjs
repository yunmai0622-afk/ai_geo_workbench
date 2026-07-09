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
    read('shared/onboardingWizardSteps.ts') +
    read('client/src/components/enterpriseProfile/wizard/OnboardingWizardShell.tsx') +
    read('client/src/components/enterpriseProfile/wizard/WizardStepFooter.tsx') +
    read('client/src/components/enterpriseProfile/wizard/WizardStepPanels.tsx') +
    read('client/src/components/enterpriseProfile/AdvancedMaterialsSection.tsx') +
    read('client/src/components/enterpriseProfile/CustomerCaseLibrarySection.tsx'),
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
  '服务首页',
  'AI 能见度诊断',
  '月度优化计划',
  '执行进度',
  '收录与 AI 复测',
  '交付报告',
  '品牌资料',
  '内容生产与发布',
  '发布执行中心',
  '搜索问题挖掘',
  '信源引用监测',
  '使用指南',
]) {
  assertContains('左侧导航', sources.layout, `label: "${item}"`);
}
assertContains('左侧导航', sources.layout, 'PLATFORM_PRODUCT_SUBTITLE');
assertContains('平台品牌文案', read('client/src/components/auth/authMarketing.ts'), '持续提升企业在 AI 搜索中的识别、信任与推荐');
assertContains('平台品牌文案', read('client/src/components/auth/authMarketing.ts'), 'AI 品牌经营系统');
for (const forbidden of ['GEO 增长工作台', 'GEO增长工作台', 'AI 搜索增长系统', 'AI搜索增长系统']) {
  assertNotContains('平台品牌文案', read('client/src/components/auth/authMarketing.ts'), forbidden);
  assertNotContains('左侧导航', sources.layout, forbidden);
  assertNotContains('index.html', read('client/index.html'), forbidden);
}
assertContains('左侧导航', sources.layout, 'title: "客户主流程"');
assertContains('左侧导航', sources.layout, 'title: "运营工具"');
assertNotContains('左侧导航', sources.layout, 'title: "增长总览"');
assertContains('旧资产进展路由', sources.app, 'LegacyAssetProgressRedirect');
assertNotContains('旧资产进展路由', sources.app, 'ProgressPage');
for (const item of [
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
  '资产进展',
  '有效动作',
  '内容模板库',
  'AI 内容诊断',
  '内容资产生产',
  '资产发布记录',
  '客户交付报告',
  '企业档案',
  '信任证据库',
  '企业项目',
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
  'GEO 品牌资产建档',
  'OnboardingWizardShell',
  'wizard-step-nav',
  'wizard-save-draft',
  'wizard-save-and-continue',
  'wizard-complete-profile',
  'wizard-save-hint',
  'AdvancedMaterialsSection',
  'enterprise-profile-page',
]) {
  assertContains('企业档案页', sources.assets, item);
}
assertNotContains('企业档案页', sources.assets, 'Section 1 · 基本身份');
for (const item of ['先新建第一个企业项目', '新增企业项目', 'geo.projects.create', 'handleCreateProject']) {
  assertNotContains('企业档案页', sources.assets, item);
}
assertContains('客户经营看板', read('client/src/pages/ClientDashboardPage.tsx'), '客户经营看板');
assertContains('客户经营看板', read('client/src/pages/ClientDashboardPage.tsx'), 'client-business-metrics');
assertContains('客户经营看板', read('client/src/pages/ClientDashboardPage.tsx'), '下一步');
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
assertContains('内容资产生产页', read('client/src/components/weekly/PlatformContentBoard.tsx'), '生成平台稿');
for (const item of WEEKLY_CONTENT_PAGE_SOURCE_SEGMENT_MARKERS) {
  assertContains('内容资产生产页', sources.weekly, item);
}
assertContains('App 路由', sources.app, 'WeeklyContentPage');
assertContains('App 路由', sources.app, 'path="/weekly"');
const publishPage =
  read('client/src/pages/ContentPublishingCenterPage.tsx') +
  read('client/src/components/publishing/PublishStatusBar.tsx') +
  read('client/src/components/publishing/PublishTaskQueueTable.tsx') +
  read('client/src/components/publishing/PublishTaskColumnBoard.tsx') +
  read('client/src/components/publishing/LocalAgentStatusCard.tsx');
const inclusionPage = read('client/src/pages/InclusionMonitoringCenterPage.tsx');
for (const item of [
  '发布执行中心',
  'publish-center-page',
  'publish-status-overview',
  'publish-task-queue-module',
  'local-agent-status-card',
  'publish-task-queue-table',
  'createManualPublishRecord',
  'updateManualPublishRecord',
  'publish-account-client-fold',
]) {
  assertContains('发布中心页', publishPage, item);
}
for (const item of ['连接发布平台', '可由交付人员配置', '风险边界', '支持方式', 'browser-extension.zip', '下载 Chrome 插件']) {
  assertNotContains('发布中心页', publishPage, item);
}
const inclusionFillPanel = read('client/src/components/inclusion-monitoring/ContentAssetEffectFillPanel.tsx');
for (const item of ['内容资产效果', '内容资产列表', '平台效果汇总', '加入AI复测', '收录验证后3天可进入AI复测']) {
  assertContains('收录监测页', inclusionPage, item);
}
assertContains('收录监测页', inclusionFillPanel, '填写效果数据');
const deliveryReportPage =
  read('client/src/pages/DeliveryReportsCenterPage.tsx') +
  read('shared/monthlyReportView.ts') +
  read('client/src/lib/deliveryReportProductDisplay.ts') +
  read('client/src/components/delivery/DeliveryReportProductBody.tsx');
const deliveryReportShareAdmin =
  read('client/src/components/delivery/DeliveryReportShareRenewalReminderCard.tsx') +
  read('shared/deliveryReportPublicShare.ts') +
  read('server/routers.ts');
const deliveryReportPages = deliveryReportPage + sources.customerView;
for (const item of [
  'AI 品牌成熟度月报',
  'delivery-report-page',
  'monthly-report-summary',
  'monthly-report-actions',
  'monthly-report-next-month',
  'monthly-report-history',
]) {
  assertContains('交付报告页', deliveryReportPage, item);
}
for (const item of ['不承诺保证收录、排名或 AI 推荐', '复测完成后自动生成']) {
  assertContains('交付报告页', deliveryReportPages, item);
}
assertContains('App 路由', sources.app, 'path="/delivery-reports/share/:projectId"');
assertContains('App 路由', sources.app, 'path="/delivery-reports/public/:token"');
assertContains('App 路由', sources.app, 'path="/delivery-reports/public/:token/evidence/:monitoringId/:resultIndex"');
for (const item of ['renewShareLink', 'shareExpiresAt', 'delivery-report-share-renewal-reminder']) {
  assertContains('交付报告分享', deliveryReportShareAdmin, item);
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

const placeholderPattern = /\b(Lorem|Ipsum|Coming Soon|coming soon|Untitled|New Project|Dashboard)\b/;
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
