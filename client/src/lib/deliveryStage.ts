import type { WorkspaceSummaryMetrics } from "@shared/workspaceStateMachine";

export const DELIVERY_STAGES = [
  "S1_PROFILE_INCOMPLETE",
  "S2_READY_FOR_DIAGNOSIS",
  "S3_READY_FOR_CONTENT",
  "S4_READY_FOR_PUBLISH",
  "S5_WAITING_LINKS",
  "S6_READY_FOR_MONITORING",
  "S7_READY_FOR_REPORT",
  "S8_DELIVERED_OR_NEXT_ROUND",
] as const;

export type DeliveryStageId = (typeof DELIVERY_STAGES)[number];

export type DeliveryStageView = {
  stage: DeliveryStageId;
  stageLabel: string;
  stageDescription: string;
  blockingReasons: string[];
  primaryAction: { label: string; path: string };
  secondaryActions: Array<{ label: string; path: string }>;
  todos: string[];
  progressSteps: Array<{ key: string; label: string; done: boolean }>;
  metrics: {
    geoScore: number | null;
    mentionRate: number | null;
    recommendRate: number | null;
    articleCount: number;
    publishRecordCount: number;
    retestPendingCount: number;
    reportCount: number;
  };
};

type Input = WorkspaceSummaryMetrics & { localAgentOnline: boolean | null };

function hasMonitoring(metrics: WorkspaceSummaryMetrics): boolean {
  return metrics.monitoringRecordCount > 0 || metrics.aiTestResultCount > 0 || metrics.hasCompletedT1Retest;
}

function buildProgressSteps(metrics: WorkspaceSummaryMetrics) {
  return [
    { key: "profile", label: "品牌资产建档", done: metrics.p0ProfileComplete },
    { key: "diagnosis", label: "AI 实测诊断", done: metrics.hasAnalysis || metrics.hasGeoScore },
    { key: "content", label: "GEO 内容任务", done: metrics.articleCount > 0 },
    { key: "publish", label: "平台适配发布", done: metrics.publishRecordCount > 0 || metrics.completedPublishTaskCount > 0 },
    { key: "links", label: "回填公开链接", done: metrics.monitoringRecordCount > 0 },
    { key: "monitor", label: "T1/T2/T3 复测", done: hasMonitoring(metrics) },
    { key: "score", label: "GEO 评分与归因", done: metrics.hasGeoScore || metrics.aiTestResultCount > 0 },
    { key: "report", label: "交付报告", done: metrics.reportCount > 0 },
  ];
}

export function resolveDeliveryStageView(input: Input): DeliveryStageView {
  const metrics = {
    geoScore: input.geoScore,
    mentionRate: input.brandMentionRate,
    recommendRate: input.recommendRate,
    articleCount: input.articleCount,
    publishRecordCount: input.publishRecordCount,
    retestPendingCount: input.retestPendingCount,
    reportCount: input.reportCount,
  };
  const progressSteps = buildProgressSteps(input);

  if (!input.p0ProfileComplete) {
    return {
      stage: "S1_PROFILE_INCOMPLETE",
      stageLabel: "建档中",
      stageDescription: "企业 8 项核心资料尚未补齐，当前无法稳定推进后续交付。",
      blockingReasons: ["企业核心资料未完成。"],
      primaryAction: { label: "继续建档", path: "/enterprise-profile" },
      secondaryActions: [{ label: "查看项目工作台", path: "/workspace" }],
      todos: ["补齐企业资料必填项", "确认品牌定位和目标客群"],
      progressSteps,
      metrics,
    };
  }
  if (!input.hasAnalysis && !input.hasGeoScore) {
    return {
      stage: "S2_READY_FOR_DIAGNOSIS",
      stageLabel: "待诊断",
      stageDescription: "已完成建档，但缺少 AI 实测诊断结果。",
      blockingReasons: ["尚未产出 AI 诊断与评分。"],
      primaryAction: { label: "开始诊断", path: "/ai-diagnosis" },
      secondaryActions: [{ label: "查看建档资料", path: "/enterprise-profile" }],
      todos: ["执行 T0 基线实测", "确认核心问题集"],
      progressSteps,
      metrics,
    };
  }
  if (input.articleCount <= 0) {
    return {
      stage: "S3_READY_FOR_CONTENT",
      stageLabel: "待生成内容",
      stageDescription: "已有诊断结果，但缺少可交付内容资产。",
      blockingReasons: ["暂无可发布内容资产。"],
      primaryAction: { label: "生成内容", path: "/weekly" },
      secondaryActions: [{ label: "回看诊断结论", path: "/ai-diagnosis" }],
      todos: ["基于诊断创建内容任务", "至少生成 1 篇可发布内容"],
      progressSteps,
      metrics,
    };
  }
  if (input.publishRecordCount <= 0 && input.publishTaskCount <= 0) {
    return {
      stage: "S4_READY_FOR_PUBLISH",
      stageLabel: "待发布",
      stageDescription: "已有内容资产，但尚未建立发布动作。",
      blockingReasons: ["暂无发布任务或发布记录。"],
      primaryAction: { label: "去发布", path: "/content-publishing" },
      secondaryActions: [{ label: "查看内容资产", path: "/weekly" }],
      todos: ["建立发布任务队列", "确认可用账号状态"],
      progressSteps,
      metrics,
    };
  }
  if (input.publishRecordCount > 0 && input.waitingPublicLinkCount > 0) {
    return {
      stage: "S5_WAITING_LINKS",
      stageLabel: "待回填链接",
      stageDescription: "已有发布记录，但尚未进入公开链接回填与监测流程。",
      blockingReasons: ["缺少公开链接，无法安排 T1/T2/T3 复测。"],
      primaryAction: { label: "回填链接", path: "/content-publishing" },
      secondaryActions: [{ label: "查看发布队列", path: "/content-publishing" }],
      todos: ["补充公开链接", "准备 T1/T2/T3 复测计划"],
      progressSteps,
      metrics,
    };
  }
  if (
    (input.publishRecordWithPublicUrlCount > 0 && !hasMonitoring(input)) ||
    input.retestPendingCount > 0
  ) {
    return {
      stage: "S6_READY_FOR_MONITORING",
      stageLabel: "待复测",
      stageDescription: "链接已具备，需完成 T1/T2/T3 与 AI 搜索复测。",
      blockingReasons: ["复测未完成。"],
      primaryAction: { label: "执行复测", path: "/inclusion-monitoring" },
      secondaryActions: [{ label: "查看发布记录", path: "/content-publishing" }],
      todos: ["完成最近一轮复测", "确认提及率/推荐率变化"],
      progressSteps,
      metrics,
    };
  }
  if (input.reportCount <= 0) {
    return {
      stage: "S7_READY_FOR_REPORT",
      stageLabel: "待出报告",
      stageDescription: "监测数据已形成，可进入正式交付报告阶段。",
      blockingReasons: ["尚未生成交付报告。"],
      primaryAction: { label: "生成报告", path: "/delivery-reports" },
      secondaryActions: [{ label: "查看复测结果", path: "/inclusion-monitoring" }],
      todos: ["整理本轮执行动作", "输出下一轮优化建议"],
      progressSteps,
      metrics,
    };
  }
  return {
    stage: "S8_DELIVERED_OR_NEXT_ROUND",
    stageLabel: "已交付 / 下一轮优化",
    stageDescription: "本轮报告已完成，进入持续优化与下一轮交付。",
    blockingReasons: [],
    primaryAction: { label: "进入下一轮优化", path: "/workspace" },
    secondaryActions: [{ label: "查看交付报告", path: "/delivery-reports" }],
    todos: ["复盘本轮收益与问题", "启动下一轮内容任务"],
    progressSteps,
    metrics,
  };
}

/** 客户项目卡片主按钮文案（未知阶段回退「进入工作台」） */
export function formatStageActionLabel(stage: DeliveryStageId): string {
  const map: Record<DeliveryStageId, string> = {
    S1_PROFILE_INCOMPLETE: "继续建档",
    S2_READY_FOR_DIAGNOSIS: "开始 AI 诊断",
    S3_READY_FOR_CONTENT: "生成内容资产",
    S4_READY_FOR_PUBLISH: "去发布内容",
    S5_WAITING_LINKS: "去回填链接",
    S6_READY_FOR_MONITORING: "执行复测",
    S7_READY_FOR_REPORT: "生成交付报告",
    S8_DELIVERED_OR_NEXT_ROUND: "查看报告",
  };
  return map[stage] ?? "进入工作台";
}

/** 客户项目卡片主按钮跳转路径（不含 projectId，由 buildProjectUrl 拼接） */
export function resolveStageActionPath(stage: DeliveryStageId): string {
  const map: Record<DeliveryStageId, string> = {
    S1_PROFILE_INCOMPLETE: "/enterprise-profile",
    S2_READY_FOR_DIAGNOSIS: "/ai-diagnosis",
    S3_READY_FOR_CONTENT: "/weekly",
    S4_READY_FOR_PUBLISH: "/content-publishing",
    S5_WAITING_LINKS: "/content-publishing",
    S6_READY_FOR_MONITORING: "/inclusion-monitoring",
    S7_READY_FOR_REPORT: "/delivery-reports",
    S8_DELIVERED_OR_NEXT_ROUND: "/delivery-reports",
  };
  return map[stage] ?? "/workspace";
}

export function buildStageActionUrl(stage: DeliveryStageId, projectId: number): string {
  const path = resolveStageActionPath(stage);
  const base = path.split("?")[0] || path;
  if (stage === "S5_WAITING_LINKS") {
    return `${base}?projectId=${projectId}&filter=waiting_links`;
  }
  return `${base}?projectId=${projectId}`;
}
