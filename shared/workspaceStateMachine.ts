import { GEO_ARTICLE_MIN_PASS_SCORE } from "./const";
import { isLegacyOrphanProjectId } from "./projectNavigation";
import type { RetestDueReminder, RetestPlanView } from "./retestPlan";
import type { T0ContentGapSuggestionsResult } from "./t0ContentGapSuggestions";
import { isP0GeoProfileCompleteFromRecord } from "./geoProfileP0Readiness";
import { localAgentConnectionRiskHint, mapBooleanOnlineToConnectionStatus } from "./localAgentConnectionStatus";
import type { LocalAgentConnectionStatus } from "./localAgentConnectionStatus";
import { buildWorkspacePublishRiskHints } from "./publishReadiness";
import { workspacePublishAccountRiskHint } from "./localAgentAccountBinding";

export const WORKSPACE_STAGE_IDS = [
  "bind_publish_env",
  "complete_geo_profile",
  "ai_diagnosis",
  "generate_content",
  "publish_content",
  "retest_queue",
  "optimize",
  "delivery_report",
] as const;

export type WorkspaceStageId = (typeof WORKSPACE_STAGE_IDS)[number];

export type WorkspaceStageDefinition = {
  id: WorkspaceStageId;
  label: string;
  blockerHint: string;
  ctaLabel: string;
  ctaPath: string;
  ctaHash?: string;
};

export const WORKSPACE_STAGES: WorkspaceStageDefinition[] = [
  {
    id: "bind_publish_env",
    label: "待绑定发布环境",
    blockerHint: "本地发布客户端未连接，或当前项目尚未绑定可发布的平台账号。",
    ctaLabel: "去绑定发布账号",
    ctaPath: "/content-publishing",
    ctaHash: "#publish-platform-accounts-fold",
  },
  {
    id: "complete_geo_profile",
    label: "待完成品牌建档",
    blockerHint: "企业 P0 建档必填信息尚未补齐，内容生成缺少可靠依据。",
    ctaLabel: "继续完成品牌建档",
    ctaPath: "/enterprise-profile",
  },
  {
    id: "ai_diagnosis",
    label: "待 AI 现状诊断",
    blockerHint: "尚未完成 AI 内容诊断，系统无法给出内容方向与缺口。",
    ctaLabel: "开始 AI 实测诊断",
    ctaPath: "/ai-diagnosis",
  },
  {
    id: "generate_content",
    label: "待生成内容",
    blockerHint: "当前项目尚无内容资产，请先围绕诊断结论生成文章。",
    ctaLabel: "生成平台化内容资产",
    ctaPath: "/weekly",
  },
  {
    id: "publish_content",
    label: "待发布",
    blockerHint: "已有内容资产，但尚未登记发布或创建发布任务。",
    ctaLabel: "去发布内容",
    ctaPath: "/weekly",
  },
  {
    id: "retest_queue",
    label: "待收录监测",
    blockerHint: "已有发布记录，需要检查内容是否被 AI 平台收录和引用。",
    ctaLabel: "去收录监测",
    ctaPath: "/inclusion-monitoring",
  },
  {
    id: "optimize",
    label: "待优化",
    blockerHint: "重写池有待处理项，或 AI 实测/质量检查提示需优化。",
    ctaLabel: "查看重写池",
    ctaPath: "/content-publishing",
  },
  {
    id: "delivery_report",
    label: "可生成报告",
    blockerHint: "已有发布或监测数据，可整理客户交付报告。",
    ctaLabel: "查看交付报告",
    ctaPath: "/delivery-reports",
  },
];

export const WORKSPACE_PIPELINE_LABELS = ["建档", "诊断", "生产", "发布", "复测", "优化", "报告"] as const;

export type WorkspaceSummaryMetrics = {
  profileCompletionPercent: number;
  boundPublishAccountCount: number;
  expiredSessionAccountCount: number;
  articleCount: number;
  publishRecordCount: number;
  publishRecordWithPublicUrlCount: number;
  waitingPublicLinkCount: number;
  publishTaskCount: number;
  completedPublishTaskCount: number;
  retestPendingCount: number;
  rewriteOpenCount: number;
  aiTestResultCount: number;
  monitoringRecordCount: number;
  retestComparisonCount: number;
  reportCount: number;
  geoScore: number | null;
  brandMentionRate: number | null;
  recommendRate: number | null;
  lowQualityArticleCount: number;
  hasAnalysis: boolean;
  hasGeoScore: boolean;
  hasCompletedT0Baseline: boolean;
  hasCompletedT1Retest: boolean;
  /** 有 completed 发布且超过 7 天、且无 completed T1 复测 */
  showT1RetestAutoTriggerReminder: boolean;
  /** T1/T2/T3 复测时间计划（基于最近完成发布） */
  retestPlan: RetestPlanView;
  /** 当前最早到期且未完成的复测提醒；无则 null */
  retestDueReminder: RetestDueReminder | null;
  p0ProfileComplete: boolean;
  /** T0 完成后基于 ai_test_runs 的内容缺口建议 */
  t0ContentGapSuggestions?: T0ContentGapSuggestionsResult | null;
};

export type WorkspaceStageResolutionInput = WorkspaceSummaryMetrics & {
  /** 由浏览器检测 Local Agent；未检测时为 null */
  localAgentOnline: boolean | null;
  localAgentConnectionStatus?: LocalAgentConnectionStatus;
  localAccountSnapshotEmpty?: boolean;
};

export type WorkspaceStageResolution = {
  currentStageId: WorkspaceStageId;
  currentStage: WorkspaceStageDefinition;
  blockerReasons: string[];
  riskHints: string[];
  pipelineStepIndex: number;
};

function stageById(id: WorkspaceStageId): WorkspaceStageDefinition {
  return WORKSPACE_STAGES.find(s => s.id === id) ?? WORKSPACE_STAGES[0]!;
}

/** 与品牌资产建档页 5 分钟 P0 保存门槛对齐 */
export function isP0GeoProfileComplete(profile: Record<string, unknown> | null | undefined): boolean {
  return isP0GeoProfileCompleteFromRecord(profile);
}

export function buildWorkspaceRiskHints(input: WorkspaceStageResolutionInput): string[] {
  const connectionStatus =
    input.localAgentConnectionStatus ?? mapBooleanOnlineToConnectionStatus(input.localAgentOnline);
  const hints: string[] = buildWorkspacePublishRiskHints({
    p0ProfileComplete: input.p0ProfileComplete,
    boundPublishAccountCount: input.boundPublishAccountCount,
    localAgentOnline: input.localAgentOnline,
    localAgentConnectionStatus: connectionStatus,
    localAccountSnapshotEmpty: input.localAccountSnapshotEmpty,
  });
  if (
    (connectionStatus === "DISCONNECTED" || connectionStatus === "ERROR") &&
    input.boundPublishAccountCount > 0
  ) {
    hints.push("本地发布客户端未连接，发布任务无法下发。");
  }
  if (input.expiredSessionAccountCount > 0) hints.push(`有 ${input.expiredSessionAccountCount} 个账号登录状态失效，请重新登录。`);
  if (input.rewriteOpenCount > 0) hints.push(`重写池有 ${input.rewriteOpenCount} 条待处理内容。`);
  if (input.retestPendingCount > 0) hints.push(`复测队列有 ${input.retestPendingCount} 条待处理。`);
  if (input.brandMentionRate != null && input.aiTestResultCount > 0 && input.brandMentionRate < 0.2) {
    hints.push("AI 实测样本中品牌提及率偏低，建议进入优化与重写。");
  }
  return hints;
}

export function resolveWorkspaceStage(input: WorkspaceStageResolutionInput): WorkspaceStageResolution {
  const connectionStatus =
    input.localAgentConnectionStatus ?? mapBooleanOnlineToConnectionStatus(input.localAgentOnline);
  const publishEnvReady =
    input.boundPublishAccountCount > 0 &&
    (connectionStatus === "CONNECTED" || connectionStatus === "CONNECTED_ACCOUNT_NOT_SYNCED");
  const blockerReasons: string[] = [];
  const riskHints = buildWorkspaceRiskHints(input);

  let currentStageId: WorkspaceStageId;

  // 阶段优先级：建档 → 诊断 → 内容 → 发布环境 → 发布 → 监测 → 复测 → 报告
  if (!input.p0ProfileComplete) {
    currentStageId = "complete_geo_profile";
    blockerReasons.push("企业 P0 建档必填信息不完整。");
  } else if (!input.hasAnalysis && !input.hasGeoScore) {
    currentStageId = "ai_diagnosis";
    blockerReasons.push("尚未生成 AI 诊断结果或 GEO 评分。");
  } else if (input.articleCount === 0) {
    currentStageId = "generate_content";
    blockerReasons.push("当前项目尚无内容资产。");
  } else if (!publishEnvReady) {
    currentStageId = "bind_publish_env";
    if (connectionStatus === "DISCONNECTED" || connectionStatus === "ERROR") {
      blockerReasons.push("本地发布客户端未连接。");
    }
    if (input.boundPublishAccountCount === 0) {
      const hint = localAgentConnectionRiskHint(connectionStatus, {
        boundPublishAccountCount: input.boundPublishAccountCount,
        localAccountSnapshotEmpty: input.localAccountSnapshotEmpty,
      });
      if (hint) blockerReasons.push(hint);
      else blockerReasons.push(workspacePublishAccountRiskHint(input.localAgentOnline));
    }
  } else if (input.publishRecordCount === 0 && input.publishTaskCount === 0) {
    currentStageId = "publish_content";
    blockerReasons.push("已有内容资产，但尚无发布记录或发布任务。");
  } else if (input.publishRecordCount > 0 && input.monitoringRecordCount === 0) {
    currentStageId = "retest_queue";
    blockerReasons.push("已有发布记录，但尚未进行收录监测。");
  } else if (input.retestPendingCount > 0) {
    currentStageId = "retest_queue";
    blockerReasons.push(`复测队列仍有 ${input.retestPendingCount} 条待处理。`);
  } else if (
    input.rewriteOpenCount > 0 ||
    input.lowQualityArticleCount > 0 ||
    (input.aiTestResultCount > 0 && input.brandMentionRate != null && input.brandMentionRate < 0.25)
  ) {
    currentStageId = "optimize";
    if (input.rewriteOpenCount > 0) blockerReasons.push(`重写池有 ${input.rewriteOpenCount} 条待处理。`);
    if (input.lowQualityArticleCount > 0) {
      blockerReasons.push(`有 ${input.lowQualityArticleCount} 篇内容质量分低于 ${GEO_ARTICLE_MIN_PASS_SCORE}。`);
    }
    if (input.brandMentionRate != null && input.brandMentionRate < 0.25) {
      blockerReasons.push("AI 实测中品牌提及率偏低。");
    }
  } else if (input.publishRecordCount > 0 || input.monitoringRecordCount > 0) {
    currentStageId = "delivery_report";
    blockerReasons.push("主链路进展良好，可整理交付报告。");
  } else {
    currentStageId = "generate_content";
    blockerReasons.push("建议继续补充内容资产并推进发布。");
  }

  const pipelineStepIndex = Math.max(
    0,
    WORKSPACE_STAGE_IDS.indexOf(currentStageId === "delivery_report" ? "delivery_report" : currentStageId),
  );

  return {
    currentStageId,
    currentStage: stageById(currentStageId),
    blockerReasons: blockerReasons.length ? blockerReasons : [stageById(currentStageId).blockerHint],
    riskHints,
    pipelineStepIndex,
  };
}

export function workspaceCtaUrl(projectId: number, stage: WorkspaceStageDefinition): string {
  if (isLegacyOrphanProjectId(projectId)) {
    return stage.ctaPath;
  }
  const base = `${stage.ctaPath}?projectId=${projectId}`;
  return stage.ctaHash ? `${base}${stage.ctaHash}` : base;
}
