import type { WorkspaceSummaryMetrics } from "@shared/workspaceStateMachine";
import { GEO_UNIFIED_MAIN_PIPELINE_STEPS } from "@shared/workspaceMainChain";

/** 系统主定位（客户可见） */
export const GEO_PRODUCT_MAIN_POSITIONING =
  "GEO 代运营交付系统";

/** 系统辅助说明（客户可见） */
export const GEO_PRODUCT_SUB_POSITIONING =
  "通过 AI 能见度诊断、搜索问题挖掘、月度优化计划、内容生产与发布、收录复测和交付报告，帮助企业持续提升在 AI 搜索中的识别、信任和推荐机会。";

export const GEO_DELIVERY_SYSTEM_GUIDE_COPY =
  "这不是单纯发文章工具，而是一套 GEO 代运营交付系统。系统通过 AI 能见度诊断、搜索问题挖掘、月度优化计划、内容生产与发布、收录复测和交付报告，帮助企业持续提升在 AI 搜索中的识别、信任和推荐机会。";

export const GEO_PRODUCT_CAPABILITIES = [
  {
    title: "AI 能见度诊断",
    description: "看 AI 是否知道你、怎么描述你、是否愿意推荐你。",
  },
  {
    title: "AI 口碑与推荐分析",
    description: "看 AI 回答里对品牌的态度、推荐强弱和竞品对比。",
  },
  {
    title: "搜索问题挖掘",
    description: "挖掘用户会问 AI 的真实问题，找到高价值内容机会。",
  },
  {
    title: "月度优化计划",
    description: "把诊断结果转成每月 3 个重点服务事项。",
  },
  {
    title: "内容生产与发布",
    description: "按知乎、公众号、小红书、搜狐等平台规则生成并发布内容。",
  },
  {
    title: "信源引用监测",
    description: "检查 AI 是否能识别官网、公开资料、平台内容和品牌证据。",
  },
  {
    title: "收录与 AI 复测",
    description: "发布后监测内容是否被搜索/AI 看见，并做前后对比。",
  },
  {
    title: "交付报告与续费证明",
    description: "每月输出交付报告，说明做了什么、有什么变化、下月为什么继续。",
  },
] as const;

export type CustomerStepStatus = "未开始" | "进行中" | "已完成" | "需补充" | "有风险";

export type MainPipelineStepDef = {
  id: (typeof GEO_UNIFIED_MAIN_PIPELINE_STEPS)[number]["id"];
  title: string;
  shortLabel: string;
  customerDescription: string;
  path: string;
  emptyHint: string;
};

export const COCKPIT_PIPELINE_STEPS = GEO_UNIFIED_MAIN_PIPELINE_STEPS.map(s => s.shortLabel);

export const GEO_CONTENT_ASSET_TYPES = [
  "品牌解释型内容",
  "产品对比型内容",
  "用户问题解答型内容",
  "案例证明型内容",
  "行业观点型内容",
  "FAQ 问答型内容",
] as const;

export const BRAND_ASSET_LIBRARY_GROUPS = [
  {
    tier: "必填信息",
    items: ["企业基础信息", "产品/服务信息", "目标客户"],
  },
  {
    tier: "推荐补充",
    items: ["核心优势", "客户案例", "希望被 AI 推荐的问题"],
  },
  {
    tier: "高级选填",
    items: ["权威背书", "竞品信息", "官网/社媒/媒体链接"],
  },
] as const;

export const PLATFORM_PUBLISH_STRATEGY_NOTES = [
  { platform: "小红书", strategy: "场景化、经验感、轻案例" },
  { platform: "知乎", strategy: "问题导向、专业解释、对比分析" },
  { platform: "搜狐号 / 网易号", strategy: "品牌稿、行业稿、案例稿" },
  { platform: "官网", strategy: "权威品牌资料库" },
  { platform: "公众号", strategy: "深度内容与用户教育" },
] as const;

export type MainPipelineStepView = MainPipelineStepDef & {
  status: CustomerStepStatus;
  nextAction: string;
};

export function resolveMainPipelineStepStatuses(
  metrics: WorkspaceSummaryMetrics | null | undefined,
  extras?: { localAgentOnline?: boolean | null },
): MainPipelineStepView[] {
  const m = metrics;
  const agentRisk = extras?.localAgentOnline === false;

  return GEO_UNIFIED_MAIN_PIPELINE_STEPS.map(step => {
    switch (step.id) {
      case "profile_basics": {
        if (!m) return view(step, "未开始", "完成企业资料建档");
        if (m.p0ProfileComplete) return view(step, "已完成", "查看或更新企业资料");
        if (m.profileCompletionPercent > 0) return view(step, "进行中", "继续补齐必填建档信息");
        return view(step, "需补充", "填写企业基础信息");
      }
      case "ai_search_test_t0": {
        if (!m) return view(step, "未开始", step.emptyHint);
        if (m.aiTestResultCount > 0) return view(step, "已完成", "查看实测明细与引用来源");
        if (m.hasAnalysis) return view(step, "进行中", "发起 AI 搜索实测");
        return view(step, "未开始", step.emptyHint);
      }
      case "brand_assets": {
        if (!m) return view(step, "未开始", "进入品牌资产库补充材料");
        if (m.profileCompletionPercent >= 70) return view(step, "已完成", "继续补充案例与背书");
        if (m.p0ProfileComplete) return view(step, "需补充", "补充案例、背书与推荐问题");
        if (m.profileCompletionPercent > 20) return view(step, "进行中", "补充推荐品牌资产");
        return view(step, "未开始", "先完成基础建档");
      }
      case "content_assets": {
        if (!m) return view(step, "未开始", step.emptyHint);
        if (m.lowQualityArticleCount > 0) return view(step, "有风险", "优化低分内容后再发布");
        if (m.articleCount > 0) return view(step, "已完成", "查看或新增内容资产");
        if (m.hasAnalysis) return view(step, "进行中", "根据实测缺口生成内容");
        return view(step, "未开始", step.emptyHint);
      }
      case "platform_publish": {
        if (!m) return view(step, "未开始", step.emptyHint);
        if (agentRisk || m.expiredSessionAccountCount > 0) {
          return view(step, "有风险", "检查发布账号与环境后登记发布");
        }
        if (m.publishRecordCount > 0) return view(step, "已完成", "登记新的发布或查看任务");
        if (m.articleCount > 0) return view(step, "进行中", "人工确认发布或登记结果");
        return view(step, "未开始", step.emptyHint);
      }
      case "inclusion_monitor_retest": {
        if (!m) return view(step, "未开始", step.emptyHint);
        if (m.retestPendingCount > 0) return view(step, "有风险", "处理待复测项");
        if (m.monitoringRecordCount > 0) return view(step, "已完成", "查看收录与 AI 引用变化");
        if (m.publishRecordCount > 0) return view(step, "进行中", "发起收录与 AI 复测");
        return view(step, "未开始", step.emptyHint);
      }
      case "geo_score": {
        if (!m) return view(step, "未开始", step.emptyHint);
        if (m.hasGeoScore && m.geoScore != null) return view(step, "已完成", "查看评分与竞品对比");
        if (m.hasAnalysis) return view(step, "进行中", "完成实测后生成 GEO 评分");
        return view(step, "未开始", step.emptyHint);
      }
      case "delivery_report": {
        if (!m) return view(step, "未开始", step.emptyHint);
        if (m.rewriteOpenCount > 0) return view(step, "有风险", "先处理重写池再交付");
        if (m.monitoringRecordCount > 0 || m.publishRecordCount > 0) {
          return view(step, "进行中", "生成交付报告并制定下轮优化");
        }
        return view(step, "未开始", step.emptyHint);
      }
      default:
        return view(step, "未开始", "查看本步骤");
    }
  });
}

function view(
  step: MainPipelineStepDef,
  status: CustomerStepStatus,
  nextAction: string,
): MainPipelineStepView {
  return { ...step, status, nextAction };
}

export function cockpitPipelineIndexFromMetrics(
  metrics: WorkspaceSummaryMetrics | null | undefined,
): number {
  const steps = resolveMainPipelineStepStatuses(metrics);
  const inProgress = steps.findIndex(s => s.status === "进行中" || s.status === "需补充" || s.status === "有风险");
  if (inProgress >= 0) return inProgress;
  const lastDone = [...steps].reverse().findIndex(s => s.status === "已完成");
  if (lastDone >= 0) return steps.length - 1 - lastDone;
  return 0;
}
