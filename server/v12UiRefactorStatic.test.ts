import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf-8");

describe("V1.2 可售卖版产品体验静态回归", () => {
  it("首页是 AI GEO 增长工作台，并展示 6 步闭环与继续下一步", () => {
    const homeSource = readProjectFile("client/src/pages/Home.tsx");
    expect(homeSource).toContain("AI GEO 增长工作台");
    expect(homeSource).toContain("建档、诊断、内容、发布、监测、报告");
    expect(homeSource).toContain("继续下一步");
    expect(homeSource).toContain("6 步进度条");
    expect(homeSource).toContain("核心指标");
    expect(homeSource).toContain("当前风险提醒");
    expect(homeSource).toContain("本轮试跑闭环已完成");
  });

  it("侧边栏按 V1.2 主流程展示 7 个中文一级入口，并隐藏后台辅助能力", () => {
    const layoutSource = readProjectFile("client/src/components/DashboardLayout.tsx");
    for (const label of ["总览", "企业档案", "AI 诊断", "内容生成", "内容发布", "收录监测", "交付报告"]) {
      expect(layoutSource).toContain(`label: "${label}"`);
    }
    for (const forbidden of ["内容策略", "平台优先级", "事实溯源", "一致性检查", "发布前检查", "第三方素材", "AI 可引用片段", "内容增长流水线", "平台发布", "报告中心"]) {
      expect(layoutSource).not.toContain(`label: "${forbidden}"`);
    }
  });

  it("主路由把六步客户路径接入 V1.2 页面，并保留旧路径兼容", () => {
    const appSource = readProjectFile("client/src/App.tsx");
    expect(appSource).toContain("AiDiagnosisFlowPage");
    expect(appSource).toContain("ContentGenerationFlowPage");
    expect(appSource).toContain("ContentPublishingFlowPage");
    expect(appSource).toContain("InclusionMonitoringFlowPage");
    expect(appSource).toContain("DeliveryReportsFlowPage");
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
    expect(assetSource).toContain("<GeoStatusGuide");
  });

  it("企业档案页呈现六类资料和单一主动作", () => {
    const assetSource = readProjectFile("client/src/pages/AssetCenter.tsx");
    for (const text of ["企业档案", "企业基础资料", "产品服务资料", "客户案例", "竞品资料", "合规规则", "发布策略", "当前页面只保留一个主动作"]) {
      expect(assetSource).toContain(text);
    }
    expect(assetSource).toContain("资料完整度");
    expect(assetSource).toContain("资料不足时不得编造案例、数据、价格和效果承诺");
  });

  it("AI 诊断页只展示客户问题、AI 回答、诊断结果、内容缺口和下一步建议", () => {
    const flowSource = readProjectFile("client/src/pages/V12FlowPages.tsx");
    for (const text of ["客户问题", "AI 回答", "诊断结果", "内容缺口", "下一步建议"]) {
      expect(flowSource).toContain(text);
    }
    expect(flowSource).toContain("整理客户问题");
    expect(flowSource).toContain("生成诊断结果");
    expect(flowSource).toContain("进入内容生成");
  });

  it("内容生成页只展示三类推荐内容，并显示发布准入状态和阻断原因", () => {
    const flowSource = readProjectFile("client/src/pages/V12FlowPages.tsx");
    for (const text of ["竞品对比文章", "产品能力说明文章", "行业选型 / FAQ 文章", "发布准入", "阻断原因", "允许发布", "暂不可发布", "待质检"]) {
      expect(flowSource).toContain(text);
    }
  });

  it("内容发布页只展示可发布、已发布和默认折叠的第三方平台素材说明", () => {
    const flowSource = readProjectFile("client/src/pages/V12FlowPages.tsx");
    for (const text of ["可发布内容", "已发布内容", "第三方平台素材", "当前只生成可复制素材", "不自动登录第三方平台"]) {
      expect(flowSource).toContain(text);
    }
    expect(flowSource).toContain("<details");
  });

  it("收录监测页展示已发布内容监测卡片和有限样本风险", () => {
    const flowSource = readProjectFile("client/src/pages/V12FlowPages.tsx");
    for (const text of ["收录监测", "已发布内容监测卡片", "收录", "AI 提及", "AI 推荐", "最近检测时间", "当前建议", "监测结果来自有限样本"]) {
      expect(flowSource).toContain(text);
    }
  });

  it("交付报告页只展示四类报告卡片并保留风险说明", () => {
    const flowSource = readProjectFile("client/src/pages/V12FlowPages.tsx");
    for (const text of ["GEO 诊断报告", "内容生产报告", "发布监测报告", "复测优化报告", "风险说明", "只展示四类报告卡片", "不承诺保证收录、保证排名或保证被 AI 推荐"]) {
      expect(flowSource).toContain(text);
    }
  });
});
