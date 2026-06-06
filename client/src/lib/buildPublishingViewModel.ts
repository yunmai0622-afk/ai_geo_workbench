import { recordPublicLink } from "@/lib/assetProgressDisplay";
import {
  mapAgentTaskToCard,
  mapManualRecordToCard,
  type PublishTaskCardModel,
} from "@/lib/publishCenterDisplay";
import { publishPlatformCustomerLabel } from "@/lib/publishCenterDisplay";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import {
  collectExpiredPublishAccounts,
  type PublishAccountHealthGroup,
} from "@shared/publishAccountHealthCheck";
import {
  buildPublishPagePlatformCards,
  buildWeeklyPublishOverviewStats,
  type PublishPagePlatformCard,
} from "@shared/publishPageLayout";
import { buildPublishPlatformAccountOverview } from "@shared/publishPlatformAccountOverview";
import { buildPublishPlatformStatusOverview } from "@shared/publishPlatformStatusOverview";
import { isPublishReadyPlatformAccount } from "@shared/publishReadiness";

export type PublishQueueTabKey =
  | "pending"
  | "active"
  | "needs_attention"
  | "failed"
  | "completed";

type ArticleRow = {
  id: number;
  title?: string | null;
  status?: string | null;
  generationBasis?: Record<string, unknown> | null;
};

type QualityScoreRow = {
  articleId?: number;
  totalScore: number;
  blocked?: number | boolean | null;
};

type PublishRecordRow = {
  id: number;
  articleId?: number | null;
  publishTitle?: string | null;
  publishChannel?: string | null;
  publishStatus?: string | null;
  publishUrl?: string | null;
  publicUrl?: string | null;
  publishedAt?: Date | string | number | null;
  notes?: string | null;
};

type AgentTaskRow = {
  id: number;
  articleId: number;
  articleTitle: string | null;
  platform: string;
  status: string;
  expectedAccountName: string | null;
  resultUrl?: string | null;
  publishedUrl?: string | null;
  retryExhausted?: boolean;
};

export type PublishingViewModelInput = {
  projectId?: number;
  articles: ArticleRow[];
  scores: QualityScoreRow[];
  publishRecords: PublishRecordRow[];
  agentTasks: AgentTaskRow[];
  accountGroups: PublishAccountHealthGroup[];
  articleById: Map<number, ArticleRow>;
  autoInclusionByArticleAndUrl: Set<string>;
  minPassScore?: number;
};

export type AgentTaskDerivedState = {
  hasInFlightAgentTasks: boolean;
  pendingCount: number;
  failedCount: number;
  needsAttentionCount: number;
  abnormalCount: number;
  waitingLinkTaskCount: number;
  waitingLinkRecordCount: number;
  waitingLinkCount: number;
};

export type PublishingViewModel = {
  publishableArticles: ArticleRow[];
  taskCards: PublishTaskCardModel[];
  queueTabs: Record<PublishQueueTabKey, PublishTaskCardModel[]>;
  platformCards: PublishPagePlatformCard[];
  weeklyOverviewStats: ReturnType<typeof buildWeeklyPublishOverviewStats>;
  platformStatusSummary: ReturnType<typeof buildPublishPlatformStatusOverview>;
  accountStatusCards: ReturnType<typeof buildPublishPlatformAccountOverview>;
  expiredAccounts: ReturnType<typeof collectExpiredPublishAccounts>;
  boundPublishAccountCount: number;
  boundPlatformCount: number;
  availableAccountByPlatform: string[];
  readyPlatformCount: number;
  qualityByArticleId: Map<number, QualityScoreRow>;
  agentTaskDerivedState: AgentTaskDerivedState;
};

function articleLatestQuality(articleId: number | undefined, scores: QualityScoreRow[]) {
  if (!articleId) return undefined;
  return scores.find(s => s.articleId === articleId);
}

function isQualityPassed(score: QualityScoreRow | undefined, minPassScore: number) {
  return Boolean(score && !score.blocked && score.totalScore >= minPassScore);
}

function queueTabFromCard(card: PublishTaskCardModel): PublishQueueTabKey {
  if (
    card.statusRaw === "failed" ||
    card.statusRaw === "publish_failed" ||
    card.retryExhausted
  ) {
    return "failed";
  }
  if (
    card.statusRaw === "manual_required" ||
    card.statusRaw === "draft_saved" ||
    card.statusRaw === "session_expired"
  ) {
    return "needs_attention";
  }
  if (
    card.statusRaw === "pending" ||
    card.statusRaw === "pending_agent" ||
    card.statusRaw === "copied"
  ) {
    return "pending";
  }
  if (card.statusRaw === "agent_processing" || card.statusRaw === "processing") {
    return "active";
  }
  return "completed";
}

/** 发布页只读视图模型：纯派生，不触发 React 状态更新或网络请求 */
export function buildPublishingViewModel(input: PublishingViewModelInput): PublishingViewModel {
  const minPassScore = input.minPassScore ?? GEO_ARTICLE_MIN_PASS_SCORE;
  const qualityByArticleId = new Map<number, QualityScoreRow>();
  for (const score of input.scores) {
    if (typeof score.articleId === "number") qualityByArticleId.set(score.articleId, score);
  }

  const publishableArticles = input.articles.filter(a =>
    isQualityPassed(articleLatestQuality(a?.id, input.scores), minPassScore),
  );

  const taskCards: PublishTaskCardModel[] = (input.agentTasks ?? []).map(task => {
    const article = input.articleById.get(task.articleId);
    const basis = article?.generationBasis?.platformContentStrategy as Record<string, unknown> | undefined;
    const goal =
      typeof basis?.geoEnhancementGoal === "string"
        ? basis.geoEnhancementGoal
        : typeof article?.generationBasis?.geoEnhancementGoal === "string"
          ? (article.generationBasis.geoEnhancementGoal as string)
          : null;
    const publishedUrl = task.resultUrl?.trim() || "";
    const autoInclusionMonitoring =
      task.status === "completed" &&
      Boolean(publishedUrl) &&
      input.autoInclusionByArticleAndUrl.has(`${task.articleId}:${publishedUrl}`);
    return mapAgentTaskToCard(task, goal, { autoInclusionMonitoring });
  });

  for (const record of input.publishRecords ?? []) {
    const article = record.articleId ? input.articleById.get(record.articleId) : undefined;
    const mapped = mapManualRecordToCard(record, article?.title);
    if (mapped) taskCards.push(mapped);
  }

  const queueTabs: Record<PublishQueueTabKey, PublishTaskCardModel[]> = {
    pending: [],
    active: [],
    needs_attention: [],
    failed: [],
    completed: [],
  };
  for (const card of taskCards) {
    queueTabs[queueTabFromCard(card)].push(card);
  }

  const platformCards = buildPublishPagePlatformCards({
    articles: input.articles,
    qualityByArticleId,
    minPassScore,
    publishRecords: input.publishRecords,
    publishTasks: input.agentTasks,
    accountGroups: input.accountGroups,
  });

  const weeklyOverviewStats = buildWeeklyPublishOverviewStats({
    articles: input.articles,
    qualityByArticleId,
    minPassScore,
    publishRecords: input.publishRecords,
    publishTasks: input.agentTasks,
  });

  const platformStatusSummary = buildPublishPlatformStatusOverview(input.accountGroups);
  const accountStatusCards = buildPublishPlatformAccountOverview(input.accountGroups);
  const expiredAccounts = collectExpiredPublishAccounts(input.accountGroups);

  let boundPublishAccountCount = 0;
  for (const group of input.accountGroups) {
    for (const account of group.accounts ?? []) {
      if (isPublishReadyPlatformAccount({ ...account, platform: group.platform })) {
        boundPublishAccountCount += 1;
      }
    }
  }

  const boundPlatformCount = (input.accountGroups ?? []).filter(g =>
    (g.accounts ?? []).some(a => a.isEnabled),
  ).length;

  const availableAccountByPlatform = (input.accountGroups ?? [])
    .map(group => {
      const count = (group.accounts ?? []).filter(a => a.isEnabled).length;
      return `${publishPlatformCustomerLabel(group.platform)} ${count} 个`;
    })
    .filter(Boolean);

  const hasInFlightAgentTasks = (input.agentTasks ?? []).some(
    t =>
      t.status !== "completed" &&
      t.status !== "failed" &&
      t.status !== "draft_saved" &&
      t.status !== "session_expired" &&
      t.status !== "manual_required",
  );

  const waitingLinkTaskCount = (input.agentTasks ?? []).filter(
    task => task.status === "completed" && !(task.publishedUrl?.trim() || task.resultUrl?.trim()),
  ).length;

  const waitingLinkRecordCount = (input.publishRecords ?? []).filter(record => {
    const link = recordPublicLink(record);
    return !link;
  }).length;

  return {
    publishableArticles,
    taskCards,
    queueTabs,
    platformCards,
    weeklyOverviewStats,
    platformStatusSummary,
    accountStatusCards,
    expiredAccounts,
    boundPublishAccountCount,
    boundPlatformCount,
    availableAccountByPlatform,
    readyPlatformCount: platformCards.filter(card => card.canPublish).length,
    qualityByArticleId,
    agentTaskDerivedState: {
      hasInFlightAgentTasks,
      pendingCount: queueTabs.pending.length,
      failedCount: queueTabs.failed.length,
      needsAttentionCount: queueTabs.needs_attention.length,
      abnormalCount: queueTabs.failed.length + queueTabs.needs_attention.length,
      waitingLinkTaskCount,
      waitingLinkRecordCount,
      waitingLinkCount: waitingLinkTaskCount + waitingLinkRecordCount,
    },
  };
}
