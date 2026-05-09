import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf-8");

describe("V1.2 产品体验重构静态回归", () => {
  it("首页升级为 AI GEO 增长中枢并展示 11 个核心指标与闭环流程", () => {
    const homeSource = readProjectFile("client/src/pages/Home.tsx");
    expect(homeSource).toContain("AI GEO 增长中枢");
    expect(homeSource).toContain("metrics.map(metric");
    expect(homeSource).toContain("GEO 闭环流程");
    expect(homeSource).toContain("AI 今日建议");
    expect(homeSource).toContain("待处理任务");
    expect(homeSource).toContain("资料完整度");
    expect(homeSource).toContain("资产完整度");
    expect(homeSource).toContain("平台授权状态");
    expect(homeSource).toContain("风险提示");
  });

  it("侧边栏按客户路径展示 8 个中文导航入口", () => {
    const layoutSource = readProjectFile("client/src/components/DashboardLayout.tsx");
    for (const label of ["总览指挥舱", "企业资产", "AI 诊断", "内容策略", "内容生产", "平台发布", "收录监测", "报告中心"]) {
      expect(layoutSource).toContain(`label: "${label}"`);
    }
    expect(layoutSource).toContain("AI 资料中枢");
    expect(layoutSource).toContain("平台策略决策台");
    expect(layoutSource).toContain("AI 收录雷达");
    expect(layoutSource).toContain("客户交付中心");
  });

  it("核心页面统一接入 GEO 状态引导条", () => {
    const guideSource = readProjectFile("client/src/components/GeoStatusGuide.tsx");
    const geoPagesSource = readProjectFile("client/src/pages/GeoPages.tsx");
    const assetSource = readProjectFile("client/src/pages/AssetCenter.tsx");
    expect(guideSource).toContain("当前阶段");
    expect(guideSource).toContain("完成度");
    expect(guideSource).toContain("下一步动作");
    expect(guideSource).toContain("为什么要做");
    expect(guideSource).toContain("风险提醒");
    expect(geoPagesSource).toContain("<GeoStatusGuide {...guide} />");
    expect(assetSource).toContain("<GeoStatusGuide");
  });

  it("企业资产页呈现 AI 资料中枢并覆盖七类资料和平台授权状态", () => {
    const assetSource = readProjectFile("client/src/pages/AssetCenter.tsx");
    for (const text of ["AI 资料中枢", "企业基础信息与产品服务资料", "客户案例资料", "竞品资料库", "合规规则", "内容风格", "发布策略", "平台授权配置占位"]) {
      expect(assetSource).toContain(text);
    }
    expect(assetSource).toContain("资料完整度");
    expect(assetSource).toContain("后续诊断、文章依据、质量评分和发布策略推荐");
  });

  it("AI 认知扫描页面展示提及、推荐、竞品、未推荐原因、内容缺口和人工修订状态", () => {
    const geoPagesSource = readProjectFile("client/src/pages/GeoPages.tsx");
    expect(geoPagesSource).toContain("AI 认知扫描");
    expect(geoPagesSource).toContain("扫描 AI 是否提及/推荐品牌");
    for (const text of ["AI 是否提及品牌", "AI 是否推荐品牌", "推荐竞品", "未推荐原因", "内容缺口", "人工修订状态"]) {
      expect(geoPagesSource).toContain(text);
    }
  });
  it("内容生产和平台发布保留资产依据、质量评分、平台素材与风险阻断文案", () => {
    const geoPagesSource = readProjectFile("client/src/pages/GeoPages.tsx");
    const guideSource = readProjectFile("client/src/components/GeoStatusGuide.tsx");
    expect(geoPagesSource).toContain("文章发布");
    expect(geoPagesSource).toContain("生成依据");
    expect(geoPagesSource).toContain("使用了哪些企业资料");
    expect(geoPagesSource).toContain("质量总分");
    expect(geoPagesSource).toContain("第三方平台素材");
    expect(geoPagesSource).toContain("不会自动登录或自动发布");
    expect(guideSource).toContain("不可公开资料");
    expect(guideSource).toContain("保证收录或保证排名");
  });

  it("收录监测页呈现 AI 收录雷达与不可承诺收录排名的真实风险", () => {
    const geoPagesSource = readProjectFile("client/src/pages/GeoPages.tsx");
    expect(geoPagesSource).toContain("AI 收录雷达");
    expect(geoPagesSource).toContain("AI 是否提及品牌");
    expect(geoPagesSource).toContain("AI 是否推荐品牌");
    expect(geoPagesSource).toContain("竞品压制变化");
    expect(geoPagesSource).toContain("真实发布内容");
    expect(geoPagesSource).toContain("最近检测");
    expect(geoPagesSource).toContain("待人工复测");
    expect(geoPagesSource).toContain("trpc.geo.articles.publishRecords.useQuery");
    expect(geoPagesSource).toContain("不能承诺保证收录或保证排名");
  });
  it("报告中心升级为客户交付中心并展示五类报告交付物", () => {
    const geoPagesSource = readProjectFile("client/src/pages/GeoPages.tsx");
    const guideSource = readProjectFile("client/src/components/GeoStatusGuide.tsx");
    expect(geoPagesSource).toContain("客户交付中心");
    expect(geoPagesSource).toContain("五类报告交付物");
    for (const text of ["GEO 诊断报告", "内容发布报告", "收录监测报告", "复测报告", "客户交付报告"]) {
      expect(geoPagesSource).toContain(text);
      expect(guideSource).toContain(text);
    }
    expect(geoPagesSource).toContain("只引用已确认事实");
  });
});
