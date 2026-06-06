import type { WorkspaceStageId } from "@shared/workspaceStateMachine";

/** 客户可读阶段（不暴露内部枚举名） */
export const CUSTOMER_STAGE_LABELS: Record<WorkspaceStageId, string> = {
  bind_publish_env: "待绑定发布",
  complete_geo_profile: "待建档",
  ai_diagnosis: "待诊断",
  generate_content: "待生产",
  publish_content: "待发布",
  retest_queue: "待监测",
  optimize: "优化中",
  delivery_report: "报告已生成",
};

export const COCKPIT_PIPELINE_STEPS = ["建档", "诊断", "生产", "发布", "监测", "复测", "报告"] as const;

/** GEO 分低于该值时，客户项目卡片优先提示优化，不引导先看交付报告 */
export const CLIENT_PROJECT_LOW_GEO_SCORE_THRESHOLD = 60;

export function cockpitPipelineIndex(stageId: WorkspaceStageId): number {
  const map: Record<WorkspaceStageId, number> = {
    bind_publish_env: 0,
    complete_geo_profile: 0,
    ai_diagnosis: 1,
    generate_content: 2,
    publish_content: 3,
    retest_queue: 4,
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
    const score = project.latestGeoScore;
    if (score != null && score < CLIENT_PROJECT_LOW_GEO_SCORE_THRESHOLD) {
      return {
        stageLabel: "优化中",
        nextStep: "GEO 分偏低，优先优化内容质量与收录表现，提升可见度后再查看交付报告",
      };
    }
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

/** 客户项目卡片右上角：完整阶段标签（勿再包一层「第 X 步」） */
export function deriveClientProjectPipelineBadgeLabel(project: ClientProjectCardInput): string {
  return deriveClientProjectCardDisplay(project).stageLabel;
}

/** @deprecated 旧版短标签仅用于兼容；新 UI 请用 deriveClientProjectPipelineBadgeLabel */
export function deriveClientProjectEightStepLabel(project: ClientProjectCardInput): string {
  if (project.publishCount > 0 && project.aiTestCount > 0) return "交付";
  if (project.publishCount > 0) return "监测";
  if (project.articleCount > 0) return "发布";
  if (project.latestGeoScore != null) return "内容";
  if (project.status === "analysis_done" || project.status === "score_done") return "内容";
  if (project.status === "responses_imported") return "评分";
  if (project.aiTestCount > 0) return "实测";
  return "建档";
}

export function formatBrandMentionRate(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) return "完成AI实测后显示";
  return `${Math.round(rate * 100)}%`;
}

export type ClientProjectMentionRateInput = {
  mentionRate: number | null | undefined;
  hasAiTestData: boolean;
  loading?: boolean;
};

/** 客户项目卡片：品牌提及率展示（不伪造、不用无意义 --） */
export function formatClientProjectMentionRate(input: ClientProjectMentionRateInput): string {
  if (input.loading) return "加载中";
  if (input.mentionRate != null && !Number.isNaN(input.mentionRate)) {
    return `${Math.round(input.mentionRate * 100)}%`;
  }
  if (input.hasAiTestData) return "0%";
  return "未实测";
}

export function formatMeasuredAt(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatGeoScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "--";
  return String(Math.round(score));
}

export function displayRegionIndustry(industry?: string | null, region?: string | null): string {
  const parts = [industry?.trim(), region?.trim()].filter(Boolean);
  return parts.length ? parts.join(" · ") : "未填写";
}
