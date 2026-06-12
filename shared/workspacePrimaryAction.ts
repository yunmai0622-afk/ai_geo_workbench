import type { WorkspaceSummaryMetrics } from "./workspaceStateMachine";

export type WorkspaceStagePrimaryActionId =
  | "ai_diagnosis"
  | "maturity_assessment"
  | "content_optimization"
  | "publish_execution";

export type WorkspaceStagePrimaryAction = {
  id: WorkspaceStagePrimaryActionId;
  /** 工作台「当前阶段」主标题 */
  stageHeadline: string;
  /** 阶段分组标题（如「内容优化期」） */
  phaseTitle: string;
  /** 阶段分组说明 */
  phaseDescription: string;
  ctaLabel: string;
  /** 不含 projectId，由前端 buildProjectUrl 拼接 */
  ctaPath: string;
  reason: string;
};

export type WorkspaceStagePrimaryActionInput = Pick<
  WorkspaceSummaryMetrics,
  | "hasCompletedT0Baseline"
  | "articleCount"
  | "pendingPublishContentCount"
  | "publishRecordCount"
  | "publishTaskCount"
  | "lowQualityArticleCount"
  | "rewriteOpenCount"
> & {
  /** 最新 AI 品牌成熟度总分；未计算或为 0 时进入成熟度阶段 */
  maturityTotalScore?: number | null;
  /** 待人工审核内容数（可选，服务端未聚合时用 0） */
  pendingReviewCount?: number;
};

/**
 * 工作台阶段与主按钮统一规则（命中即停止）：
 * 1. 未完成 AI 现状检测
 * 2. 已完成检测但成熟度未计算/为 0
 * 3. 成熟度已计算，但有待审核/待生成内容
 * 4. 有待发布内容（可入队）
 */
export function resolveWorkspaceStagePrimaryAction(
  input: WorkspaceStagePrimaryActionInput,
): WorkspaceStagePrimaryAction | null {
  if (!input.hasCompletedT0Baseline) {
    return {
      id: "ai_diagnosis",
      stageHeadline: "AI 现状检测",
      phaseTitle: "AI检测期",
      phaseDescription: "检测AI目前是否推荐你",
      ctaLabel: "开始 AI 现状检测",
      ctaPath: "/ai-diagnosis",
      reason: "尚未完成 AI 现状检测，需要先建立品牌在 AI 搜索中的可见度基线。",
    };
  }

  const maturityScore = input.maturityTotalScore;
  if (maturityScore == null || maturityScore <= 0) {
    return {
      id: "maturity_assessment",
      stageHeadline: "AI 品牌成熟度评估",
      phaseTitle: "AI检测期",
      phaseDescription: "了解当前 AI 搜索可见性水平",
      ctaLabel: "查看 AI 品牌成熟度",
      ctaPath: "/maturity",
      reason: "AI 现状检测已完成，建议查看 AI 品牌成熟度评估结果。",
    };
  }

  const pendingReviewCount = input.pendingReviewCount ?? 0;
  const hasContentOptimizationWork =
    input.articleCount === 0 ||
    pendingReviewCount > 0 ||
    input.lowQualityArticleCount > 0 ||
    input.rewriteOpenCount > 0;
  if (hasContentOptimizationWork) {
    return {
      id: "content_optimization",
      stageHeadline: "内容优化期",
      phaseTitle: "内容优化期",
      phaseDescription: "补充内容和信源，提升AI推荐",
      ctaLabel: "去内容生产工作台",
      ctaPath: "/weekly",
      reason:
        input.articleCount === 0
          ? "已有成熟度评估，建议围绕诊断结论生成首批内容资产。"
          : "仍有待生成、待审核或待优化内容，建议先在内容生产工作台处理。",
    };
  }

  const hasPublishableContent =
    (input.pendingPublishContentCount ?? 0) > 0 ||
    (input.articleCount > 0 && input.publishRecordCount === 0 && input.publishTaskCount === 0);
  if (hasPublishableContent) {
    return {
      id: "publish_execution",
      stageHeadline: "发布内容到各平台",
      phaseTitle: "发布执行期",
      phaseDescription: "发布内容到各平台",
      ctaLabel: "去平台适配发布",
      ctaPath: "/content-publishing",
      reason: "已有可发布内容，建议进入平台适配发布并加入发布队列。",
    };
  }

  return null;
}
