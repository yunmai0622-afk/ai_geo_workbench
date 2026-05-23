import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf-8");

describe("V1.0 可售卖版产品体验静态回归", () => {
  it("首页展示增长驾驶舱、行动卡与核心指标", () => {
    const homeSource = readProjectFile("client/src/pages/Home.tsx") + readProjectFile("client/src/components/V1WorkbenchOverview.tsx");
    expect(homeSource).toContain("AI 搜索增长总览");
    expect(homeSource).toContain("下一步动作");
    expect(homeSource).toContain("AiMetricCard");
    expect(homeSource).toContain("生成内容资产");
    expect(homeSource).not.toContain("V1.0 核心三步流程");
    expect(homeSource).not.toContain("关键产物入口");
  });

  it("侧边栏按客户主路径展示入口，并隐藏旧入口", () => {
    const layoutSource = readProjectFile("client/src/components/DashboardLayout.tsx");
    for (const label of ["增长总览", "企业档案", "AI 内容诊断", "内容资产生产", "资产发布记录", "资产进展看板", "客户交付报告"]) {
      expect(layoutSource).toContain(`label: "${label}"`);
    }
    for (const forbidden of ["总览", "内容生成", "内容发布", "收录监测", "内容策略", "平台优先级", "事实溯源", "一致性检查", "发布前检查", "第三方素材", "AI 可引用片段", "内容增长流水线", "报告中心"]) {
      expect(layoutSource).not.toContain(`label: "${forbidden}"`);
    }
  });

  it("主路由把六步客户路径接入 V1.2 页面，并保留旧路径兼容", () => {
    const appSource = readProjectFile("client/src/App.tsx");
    expect(appSource).toContain("AiDiagnosisFlowPage");
    expect(appSource).toContain("WeeklyContentPage");
    expect(appSource).toContain('path="/articles"');
    expect(appSource).toMatch(/path="\/articles"[\s\S]*Redirect to="\/weekly"/);
    expect(appSource).toContain("ProgressPage");
    expect(appSource).toContain("OnboardingPage");
    expect(appSource).toContain('path="/weekly"');
    expect(appSource).toContain('path="/progress"');
    expect(appSource).toContain('path="/onboarding"');
    expect(appSource).toContain("profileHasBrand");
    expect(appSource).toContain("ContentPublishingFlowPage");
    expect(appSource).toContain("InclusionMonitoringFlowPage");
    expect(appSource).toContain("DeliveryReportsFlowPage");
    expect(appSource).toContain('path="/delivery-reports/share/:projectId"');
    expect(appSource).toContain('path="/delivery-reports/public/:token"');
    for (const path of ["/ai-diagnosis", "/content-generation", "/content-publishing", "/inclusion-monitoring", "/delivery-reports", "/articles", "/publish", "/monitoring", "/reports"]) {
      expect(appSource).toContain(`path="${path}"`);
    }
  });

  it("核心页面统一接入 GEO 状态引导条", () => {
    const guideSource = readProjectFile("client/src/components/GeoStatusGuide.tsx");
    const flowSource = readProjectFile("client/src/pages/V12FlowPages.tsx");
    const assetSource = readProjectFile("client/src/pages/AssetCenter.tsx");
    for (const text of ["当前阶段", "完成度", "下一步动作", "为什么要做", "风险提醒"]) {
      expect(guideSource).toContain(text);
    }
    expect(flowSource).toContain("<GeoStatusGuide");
    expect(assetSource).toContain("AiPageShell");
  });

  it("企业档案页呈现档案配置台结构与资料完整度", () => {
    const assetSource = readProjectFile("client/src/pages/AssetCenter.tsx");
    for (const text of [
      "企业 AI 搜索档案",
      "品牌与产品信息",
      "目标客户与购买场景",
      "案例与信任素材",
      "保存基本身份",
      "保存客户信息",
      "档案完整度",
      "档案完成进度",
      "完成企业档案，进入 AI 内容诊断",
    ]) {
      expect(assetSource).toContain(text);
    }
    expect(assetSource).toContain("不得编造案例、数据、价格和效果承诺");
    expect(assetSource).not.toContain("Section 1 · 基本身份");
  });

  it("AI 诊断页客户化展示目标问题、诊断结果、评分、任务和下一步建议", () => {
    const flowSource = readProjectFile("client/src/pages/V12FlowPages.tsx");
    for (const text of [
      "内容诊断",
      "目标客户问题",
      "重新生成",
      "诊断结果",
      "内容缺口",
      "内容覆盖评分",
      "优化任务",
      "去生成内容资产",
      "核心诊断结论",
      "完整诊断明细",
      "诊断流程控制台",
      "开始 AI 内容诊断",
    ]) {
      expect(flowSource).toContain(text);
    }
    expect(flowSource).toContain("运行内容诊断");
    expect(flowSource).toContain("建议标题");
    expect(flowSource).toContain("核心论点");
    for (const forbidden of ["问题文本 questionText", "AI 平台 aiPlatform", "原始回答 rawAnswer", "analysis_results"]) {
      expect(flowSource).not.toContain(forbidden);
    }
  });

  it("内容生产页客户化展示内容计划、选题、文章、质量检查和下一步动作", () => {
    const flowSource = readProjectFile("client/src/pages/V12FlowPages.tsx");
    for (const text of ["内容生产计划", "本步骤用于根据 内容诊断结果和优化任务，制定本周内容计划", "保存内容计划", "生成本周内容选题", "内容重复风险", "进入发布记录"]) {
      expect(flowSource).toContain(text);
    }
  });

  it("发布记录页仅保留登记入口与列表，不出现平台授权配置字段", () => {
    const flowSource = readProjectFile("client/src/pages/V12FlowPages.tsx");
    for (const text of ["发布记录", "新建发布记录", "发布记录列表", "发布资产概览", "选择文章", "选择平台（多选）", "保存链接", "createManualPublishRecord", "updateManualPublishRecord", "publishRecords"]) {
      expect(flowSource).toContain(text);
    }
    for (const forbidden of ["连接发布平台", "可由交付人员配置", "风险边界", "支持方式", "appId", "appSecret", "authorizerAppId", "publishMode", "platform_authorization_configs"]) {
      expect(flowSource).not.toContain(forbidden);
    }
  });

  it("发布记录页用手动登记接口闭环，不接入真实自动发布", () => {
    const flowSource = readProjectFile("client/src/pages/V12FlowPages.tsx");
    for (const text of ["createManualPublishRecord", "updateManualPublishRecord", "publishRecords"]) {
      expect(flowSource).toContain(text);
    }
    expect(flowSource).not.toContain("trpc.geo.articles.publish.useMutation");
  });

  it("收录监测页展示已发布内容监测卡片和有限样本风险", () => {
    const flowSource = readProjectFile("client/src/pages/V12FlowPages.tsx");
    for (const text of ["收录监测", "已发布内容监测卡片", "收录", "AI 提及", "AI 推荐", "最近检测时间", "当前建议", "监测结果来自有限样本"]) {
      expect(flowSource).toContain(text);
    }
  });

  it("交付报告页为面向客户的分区结构并保留合规小字", () => {
    const flowSource = readProjectFile("client/src/pages/V12FlowPages.tsx");
    const customerView = readProjectFile("client/src/components/DeliveryReportCustomerView.tsx");
    for (const text of ["DeliveryReportCustomerView", "内容诊断结果", "优化任务清单", "已生成内容"]) {
      expect(flowSource).toContain(text);
    }
    expect(customerView).toContain("不承诺保证收录、排名或 AI 推荐");
    for (const text of ["AI 搜索可见度评分", "经营结论", "本轮新增 AI 搜索资产", "下一轮优化动作", "查看文章"]) {
      expect(customerView).toContain(text);
    }
  });
});
