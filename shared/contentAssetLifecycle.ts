import { getContentQualityGateStatus, type ContentQualityGateArticle } from "./contentQualityGate";
import {
  computeCanEnterAiRetest,
  normalizeEffectInclusionStatus,
} from "./contentAssetEffectTracking";
import { isMonitoringAiTested } from "./inclusionMonitoringDisplay";

export const CONTENT_ASSET_LIFECYCLE_STAGES = [
  "not_started",
  "generated",
  "pending_review",
  "review_passed",
  "queued",
  "published",
  "pending_inclusion",
  "included",
  "has_exposure",
  "can_retest",
  "retested",
] as const;

export type ContentAssetLifecycleStage = (typeof CONTENT_ASSET_LIFECYCLE_STAGES)[number];

export const CONTENT_ASSET_LIFECYCLE_LABELS: Record<ContentAssetLifecycleStage, string> = {
  not_started: "待生成",
  generated: "已生成",
  pending_review: "待质检",
  review_passed: "质检通过",
  queued: "已入队",
  published: "已发布",
  pending_inclusion: "待收录",
  included: "已收录",
  has_exposure: "有曝光",
  can_retest: "可复测",
  retested: "已复测",
};

export const CONTENT_ASSET_LIFECYCLE_NEXT_ACTION: Record<ContentAssetLifecycleStage, string> = {
  not_started: "选择平台并生成第一篇平台稿",
  generated: "打开内容确认正文，并执行发布前质检",
  pending_review: "完成人工质检确认，形成可发布资产",
  review_passed: "将内容加入发布队列并选择发布账号",
  queued: "等待本地 Agent 完成发布，或到发布中心查看进度",
  published: "回填公开链接，并进入收录监测登记效果",
  pending_inclusion: "在收录监测中标记收录状态，并填写阅读/曝光数据",
  included: "持续观察阅读与曝光，收录验证满 3 天后可 AI 复测",
  has_exposure: "关注曝光趋势，满足条件后安排 AI 复测",
  can_retest: "加入 AI 复测，验证品牌提及与推荐表现",
  retested: "查看复测结果，按建议优化下一轮内容",
};

const STAGE_INDEX = new Map(
  CONTENT_ASSET_LIFECYCLE_STAGES.map((stage, index) => [stage, index] as const),
);

export type ContentAssetLifecycleArticleInput = {
  status?: string | null;
  lifecycleStatus?: string | null;
  lifecycleEvents?: unknown;
  contentReviewStatus?: string | null;
  geoQualityScore?: number | null;
  geoQualityRecommendation?: string | null;
  geoQualityStale?: boolean | number | null;
  publicPath?: string | null;
};

export type ContentAssetLifecyclePublishRecordInput = {
  publishStatus?: string | null;
  publishUrl?: string | null;
  publicUrl?: string | null;
  publishedAt?: Date | string | null;
};

export type ContentAssetLifecyclePublishTaskInput = {
  status?: string | null;
};

export type ContentAssetLifecycleInclusionRecordInput = {
  effectInclusionStatus?: string | null;
  inclusionVerifiedAt?: Date | string | null;
  readCount?: number | null;
  impressionCount?: number | null;
  lastAiTestedAt?: Date | string | null;
  aiTestResults?: unknown[] | null;
};

export type ContentAssetLifecycleTestRoundInput = {
  roundType?: string | null;
  status?: string | null;
};

export type ContentAssetLifecycleInput = {
  article?: ContentAssetLifecycleArticleInput | null;
  publishRecord?: ContentAssetLifecyclePublishRecordInput | null;
  inclusionRecord?: ContentAssetLifecycleInclusionRecordInput | null;
  publishTask?: ContentAssetLifecyclePublishTaskInput | null;
  testRound?: ContentAssetLifecycleTestRoundInput | null;
  generating?: boolean;
  now?: Date;
};

export type ContentAssetLifecycleView = {
  stage: ContentAssetLifecycleStage;
  label: string;
  nextAction: string;
  stageIndex: number;
  totalStages: number;
};

function stageIndex(stage: ContentAssetLifecycleStage): number {
  return STAGE_INDEX.get(stage) ?? 0;
}

function maxStage(
  current: ContentAssetLifecycleStage,
  candidate: ContentAssetLifecycleStage,
): ContentAssetLifecycleStage {
  return stageIndex(candidate) > stageIndex(current) ? candidate : current;
}

function toGateArticle(article: ContentAssetLifecycleArticleInput): ContentQualityGateArticle {
  return {
    geoQualityScore: article.geoQualityScore,
    geoQualityRecommendation: article.geoQualityRecommendation,
    geoQualityStale: article.geoQualityStale,
    lifecycleStatus: article.lifecycleStatus,
    lifecycleEvents: article.lifecycleEvents,
    status: article.status,
    qualityStatus: article.contentReviewStatus,
  };
}

function publishLink(record?: ContentAssetLifecyclePublishRecordInput | null): string {
  return (record?.publishUrl ?? record?.publicUrl ?? "").trim();
}

function isPublishTaskQueued(task?: ContentAssetLifecyclePublishTaskInput | null): boolean {
  const status = (task?.status ?? "").trim().toLowerCase();
  if (!status) return false;
  return status !== "completed" && status !== "failed" && status !== "session_expired";
}

function isPublishTaskCompleted(task?: ContentAssetLifecyclePublishTaskInput | null): boolean {
  return (task?.status ?? "").trim().toLowerCase() === "completed";
}

function isArticlePublished(
  article?: ContentAssetLifecycleArticleInput | null,
  publishRecord?: ContentAssetLifecyclePublishRecordInput | null,
  publishTask?: ContentAssetLifecyclePublishTaskInput | null,
): boolean {
  const legacyStatus = (article?.status ?? "").trim();
  if (legacyStatus === "已发布" || legacyStatus === "待复测") return true;
  if (publishLink(publishRecord)) return true;
  if (isPublishTaskCompleted(publishTask)) return true;
  const publishStatus = (publishRecord?.publishStatus ?? "").trim();
  return publishStatus === "已发布" || publishStatus === "published" || publishStatus === "link_backfilled";
}

function hasExposure(inclusionRecord?: ContentAssetLifecycleInclusionRecordInput | null): boolean {
  const readCount = inclusionRecord?.readCount;
  const impressionCount = inclusionRecord?.impressionCount;
  return (typeof readCount === "number" && readCount > 0) ||
    (typeof impressionCount === "number" && impressionCount > 0);
}

function hasAfterPublishRetest(
  inclusionRecord?: ContentAssetLifecycleInclusionRecordInput | null,
  testRound?: ContentAssetLifecycleTestRoundInput | null,
): boolean {
  const roundType = (testRound?.roundType ?? "").trim().toLowerCase();
  const roundStatus = (testRound?.status ?? "").trim().toLowerCase();
  if (
    roundType.includes("retest") ||
    roundType.includes("compare") ||
    roundType === "after_publish"
  ) {
    if (!roundStatus || roundStatus === "completed" || roundStatus === "finished") return true;
  }

  if (isMonitoringAiTested(inclusionRecord ?? {})) {
    const results = Array.isArray(inclusionRecord?.aiTestResults) ? inclusionRecord.aiTestResults : [];
    return results.some(item => {
      if (!item || typeof item !== "object") return false;
      const stage =
        (item as { testStage?: string; stage?: string }).testStage ??
        (item as { stage?: string }).stage;
      return stage === "after_publish";
    });
  }
  return false;
}

export function contentAssetLifecycleStageLabel(stage: ContentAssetLifecycleStage): string {
  return CONTENT_ASSET_LIFECYCLE_LABELS[stage];
}

export function resolveContentAssetLifecycleStage(
  input: ContentAssetLifecycleInput,
): ContentAssetLifecycleView {
  const article = input.article ?? null;
  const publishRecord = input.publishRecord ?? null;
  const inclusionRecord = input.inclusionRecord ?? null;
  const publishTask = input.publishTask ?? null;
  const now = input.now ?? new Date();

  let stage: ContentAssetLifecycleStage = "not_started";

  if (article || input.generating) {
    stage = "generated";
  }

  if (article) {
    const legacyStatus = (article.status ?? "").trim();
    if (legacyStatus === "已生成") {
      stage = maxStage(stage, "generated");
    } else if (legacyStatus === "待质检") {
      stage = maxStage(stage, "pending_review");
    }

    const gate = getContentQualityGateStatus(toGateArticle(article));
    if (gate.reason === "missing" && legacyStatus !== "已生成") {
      stage = maxStage(stage, "pending_review");
    } else if (gate.passed) {
      stage = maxStage(stage, "review_passed");
    }

    if (isPublishTaskQueued(publishTask)) {
      stage = maxStage(stage, "queued");
    }

    if (isArticlePublished(article, publishRecord, publishTask)) {
      stage = maxStage(stage, "published");
    }
  } else if (publishRecord && publishLink(publishRecord)) {
    stage = maxStage(stage, "published");
  }

  if (stageIndex(stage) >= stageIndex("published")) {
    const hasPostPublishTracking = Boolean(inclusionRecord) || Boolean(publishLink(publishRecord));
    if (hasPostPublishTracking) {
      const inclusionStatus = normalizeEffectInclusionStatus(inclusionRecord?.effectInclusionStatus);
      if (inclusionStatus === "included") {
        stage = maxStage(stage, "included");
      } else if (!inclusionRecord || inclusionStatus === "pending" || inclusionStatus === "unverified") {
        stage = maxStage(stage, "pending_inclusion");
      }

      if (hasExposure(inclusionRecord)) {
        stage = maxStage(stage, "has_exposure");
      }

      if (
        computeCanEnterAiRetest({
          effectInclusionStatus: inclusionRecord?.effectInclusionStatus,
          inclusionVerifiedAt: inclusionRecord?.inclusionVerifiedAt,
          now,
        })
      ) {
        stage = maxStage(stage, "can_retest");
      }

      if (hasAfterPublishRetest(inclusionRecord, input.testRound ?? null)) {
        stage = maxStage(stage, "retested");
      }
    }
  }

  return {
    stage,
    label: CONTENT_ASSET_LIFECYCLE_LABELS[stage],
    nextAction: CONTENT_ASSET_LIFECYCLE_NEXT_ACTION[stage],
    stageIndex: stageIndex(stage),
    totalStages: CONTENT_ASSET_LIFECYCLE_STAGES.length,
  };
}

export function pickLaggingContentAssetLifecycleStage(
  views: ContentAssetLifecycleView[],
): ContentAssetLifecycleView | null {
  if (views.length === 0) return null;
  return views.reduce((lagging, current) =>
    current.stageIndex < lagging.stageIndex ? current : lagging,
  );
}

export function buildContentAssetLifecycleProgressLabels(
  currentStage: ContentAssetLifecycleStage,
): Array<{ stage: ContentAssetLifecycleStage; label: string; reached: boolean; current: boolean }> {
  const currentIndex = stageIndex(currentStage);
  return CONTENT_ASSET_LIFECYCLE_STAGES.map(stage => ({
    stage,
    label: CONTENT_ASSET_LIFECYCLE_LABELS[stage],
    reached: stageIndex(stage) <= currentIndex,
    current: stage === currentStage,
  }));
}
