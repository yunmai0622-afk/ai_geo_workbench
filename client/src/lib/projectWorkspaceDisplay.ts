import type { WorkspaceStageId } from "@shared/workspaceStateMachine";

/** 客户可读阶段（不暴露内部枚举名） */
export const CUSTOMER_STAGE_LABELS: Record<WorkspaceStageId, string> = {
  bind_publish_env: "待发布",
  complete_geo_profile: "待建档",
  ai_diagnosis: "待诊断",
  generate_content: "待生产",
  publish_content: "待发布",
  retest_queue: "待复测",
  optimize: "优化中",
  delivery_report: "报告已生成",
};

export const COCKPIT_PIPELINE_STEPS = ["建档", "诊断", "生产", "发布", "监测", "复测", "报告"] as const;

export function cockpitPipelineIndex(stageId: WorkspaceStageId): number {
  const map: Record<WorkspaceStageId, number> = {
    bind_publish_env: 0,
    complete_geo_profile: 0,
    ai_diagnosis: 1,
    generate_content: 2,
    publish_content: 3,
    retest_queue: 5,
    optimize: 5,
    delivery_report: 6,
  };
  return map[stageId] ?? 0;
}

export type ClientProjectCardInput = {
  status: string;
  articleCount: number;
  publishCount: number;
  latestGeoScore: number | null;
  aiTestCount: number;
};

/** 客户项目卡片：仅用 listProjectsSummary 已有字段推断阶段（无 mock） */
export function deriveClientProjectCardDisplay(project: ClientProjectCardInput): {
  stageLabel: string;
  nextStep: string;
} {
  if (project.publishCount > 0 && project.aiTestCount > 0) {
    return { stageLabel: "报告已生成", nextStep: "查看交付报告或继续优化收录表现" };
  }
  if (project.publishCount > 0) {
    return { stageLabel: "待复测", nextStep: "进入收录监测，查看 AI 实测结果" };
  }
  if (project.articleCount > 0) {
    return { stageLabel: "待发布", nextStep: "前往发布中心，登记或执行发布任务" };
  }
  if (project.latestGeoScore != null) {
    return { stageLabel: "待生产", nextStep: "前往平台化内容生产，生成 GEO 内容资产" };
  }
  if (project.status === "analysis_done" || project.status === "score_done") {
    return { stageLabel: "待生产", nextStep: "基于诊断结论生成内容资产" };
  }
  if (project.status === "responses_imported") {
    return { stageLabel: "待诊断", nextStep: "完成 AI 现状诊断并查看 GEO 评分" };
  }
  return { stageLabel: "待建档", nextStep: "完成 GEO 建档，补齐企业基础信息" };
}

export function formatGeoScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "--";
  return String(Math.round(score));
}

export function displayRegionIndustry(industry?: string | null, region?: string | null): string {
  const parts = [industry?.trim(), region?.trim()].filter(Boolean);
  return parts.length ? parts.join(" · ") : "未填写";
}
