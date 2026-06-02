import {
  getArticlePublishPlatform,
  normalizePublishPlatform,
  type WeeklyPlatformKey,
} from "./articlePublishPlatform";
import { PUBLISH_PLATFORM_LABELS, type BindingPublishPlatform } from "./platformAccountVerify";
import {
  customerMessageForAgentPublishFailure,
  customerMessageForPublishError,
  publishTaskStatusCustomerLabel,
} from "./publishTaskErrors";

/** 发布页平台卡片展示顺序（客户指定） */
export const PUBLISH_PAGE_PLATFORM_ORDER = [
  "zhihu",
  "baijiahao",
  "toutiao",
  "sohu",
  "xiaohongshu",
  "netease",
  "wechat",
  "other",
] as const;

export type PublishPagePlatformKey = (typeof PUBLISH_PAGE_PLATFORM_ORDER)[number];

const PUBLISH_PAGE_PLATFORM_LABELS: Record<PublishPagePlatformKey, string> = {
  zhihu: "知乎",
  baijiahao: "百家号",
  toutiao: "头条号",
  sohu: "搜狐号",
  xiaohongshu: "小红书",
  netease: "网易号",
  wechat: "公众号",
  other: "其他",
};

export type PublishPageArticleInput = {
  id: number;
  title?: string | null;
  status?: string | null;
  targetPlatform?: string | null;
  publishPlatform?: string | null;
  generationBasis?: Record<string, unknown> | null;
  publishedAt?: Date | string | number | null;
  lastPublishRecordAt?: Date | string | number | null;
};

export type PublishPageQualityInput = {
  articleId?: number;
  totalScore: number;
  blocked?: number | boolean | null;
};

export type PublishPageTaskInput = {
  id: number;
  articleId: number;
  platform: string;
  status: string;
  articleTitle?: string | null;
  agentErrorMessage?: string | null;
  agentErrorType?: string | null;
  resultUrl?: string | null;
  draftUrl?: string | null;
  canRetry?: boolean;
  retryExhausted?: boolean;
  agentFinishedAt?: Date | string | number | null;
  createdAt?: Date | string | number | null;
};

export type PublishPageRecordInput = {
  id: number;
  articleId?: number | null;
  publishChannel?: string | null;
  publishStatus?: string | null;
  publishTitle?: string | null;
  publishedAt?: Date | string | number | null;
};

export type PublishPageAccountGroupInput = {
  platform: string;
  accounts: ReadonlyArray<{ isEnabled: boolean }>;
};

export type WeeklyPublishOverviewStats = {
  generatedCount: number;
  publishedCount: number;
  pendingCount: number;
  lastPublishedAt: Date | string | number | null;
};

export type PublishPagePlatformStatus =
  | "not_bound"
  | "no_content"
  | "pending_confirm"
  | "ready"
  | "publishing"
  | "published"
  | "failed"
  | "manual_only";

export type PublishPagePlatformCard = {
  key: PublishPagePlatformKey;
  label: string;
  bound: boolean;
  manualOnly: boolean;
  weeklyTitlePreview: string | null;
  articleId: number | null;
  status: PublishPagePlatformStatus;
  statusLabel: string;
  failureReason: string | null;
  taskId: number | null;
  recordId: number | null;
  previewUrl: string | null;
  canPreview: boolean;
  canPublish: boolean;
  canRetry: boolean;
  publishQueueSlug: BindingPublishPlatform | "wechat" | null;
};

function startOfLocalWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isWithinCurrentWeek(value: Date | string | number | null | undefined, now = new Date()): boolean {
  if (value == null) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() >= startOfLocalWeek(now).getTime();
}

function parseTime(value: Date | string | number | null | undefined): number | null {
  if (value == null) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function maxTime(
  ...values: Array<Date | string | number | null | undefined>
): Date | string | number | null {
  let best: number | null = null;
  let raw: Date | string | number | null = null;
  for (const value of values) {
    const t = parseTime(value);
    if (t == null) continue;
    if (best == null || t > best) {
      best = t;
      raw = value ?? null;
    }
  }
  return raw;
}

export function formatPublishOverviewTime(value: Date | string | number | null): string {
  if (value == null) return "暂无";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "暂无";
  return d.toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" });
}

function articlePlatformKey(article: PublishPageArticleInput): WeeklyPlatformKey {
  const resolved = getArticlePublishPlatform({
    generationBasis: article.generationBasis ?? null,
    targetPlatform: article.targetPlatform,
    publishPlatform: article.publishPlatform,
  });
  return resolved.weeklyPlatformKey;
}

function channelToPlatformKey(channel: string | null | undefined): PublishPagePlatformKey | null {
  const normalized = normalizePublishPlatform(channel);
  const key = normalized.weeklyPlatformKey;
  return (PUBLISH_PAGE_PLATFORM_ORDER as readonly string[]).includes(key)
    ? (key as PublishPagePlatformKey)
    : null;
}

function taskPlatformKey(platform: string): PublishPagePlatformKey | null {
  if ((PUBLISH_PAGE_PLATFORM_ORDER as readonly string[]).includes(platform)) {
    return platform as PublishPagePlatformKey;
  }
  const normalized = normalizePublishPlatform(platform);
  const key = normalized.weeklyPlatformKey;
  return (PUBLISH_PAGE_PLATFORM_ORDER as readonly string[]).includes(key)
    ? (key as PublishPagePlatformKey)
    : null;
}

function isQualityPassed(score: PublishPageQualityInput | undefined, minPassScore: number): boolean {
  return Boolean(score && !score.blocked && score.totalScore >= minPassScore);
}

const IN_FLIGHT_TASK_STATUSES = new Set([
  "pending",
  "pending_agent",
  "copied",
  "agent_processing",
  "processing",
  "manual_required",
  "draft_saved",
  "session_expired",
]);

export function buildWeeklyPublishOverviewStats(input: {
  articles: ReadonlyArray<PublishPageArticleInput>;
  qualityByArticleId: ReadonlyMap<number, PublishPageQualityInput>;
  minPassScore: number;
  publishRecords: ReadonlyArray<PublishPageRecordInput>;
  publishTasks: ReadonlyArray<PublishPageTaskInput>;
  now?: Date;
}): WeeklyPublishOverviewStats {
  const now = input.now ?? new Date();
  const weekArticles = input.articles.filter(a => {
    const publishedAt = a.publishedAt ?? a.lastPublishRecordAt;
    return isWithinCurrentWeek(publishedAt, now) || a.status !== "已发布";
  });

  let generatedCount = 0;
  let publishedCount = 0;
  let pendingCount = 0;

  for (const article of weekArticles) {
    const q = input.qualityByArticleId.get(article.id);
    const pass = isQualityPassed(q, input.minPassScore);
    if (article.status === "已发布") {
      publishedCount += 1;
      if (pass || article.title?.trim()) generatedCount += 1;
      continue;
    }
    if (pass || article.title?.trim()) {
      generatedCount += 1;
      pendingCount += 1;
    }
  }

  const recordTimes = input.publishRecords
    .filter(r => isWithinCurrentWeek(r.publishedAt, now))
    .map(r => r.publishedAt);
  const taskTimes = input.publishTasks
    .filter(t => t.status === "completed" && isWithinCurrentWeek(t.agentFinishedAt ?? t.createdAt, now))
    .map(t => t.agentFinishedAt ?? t.createdAt);

  return {
    generatedCount,
    publishedCount,
    pendingCount,
    lastPublishedAt: maxTime(...recordTimes, ...taskTimes),
  };
}

function statusLabelFor(status: PublishPagePlatformStatus, taskStatus?: string): string {
  switch (status) {
    case "not_bound":
      return "未绑定账号";
    case "no_content":
      return "本周暂无内容";
    case "pending_confirm":
      return "待确认质量";
    case "ready":
      return "待发布";
    case "publishing":
      return taskStatus
        ? publishTaskStatusCustomerLabel({ status: taskStatus })
        : "发布处理中";
    case "published":
      return "本周已发布";
    case "failed":
      return "发布失败";
    case "manual_only":
      return "人工发布";
    default:
      return "—";
  }
}

export function buildPublishPagePlatformCards(input: {
  articles: ReadonlyArray<PublishPageArticleInput>;
  qualityByArticleId: ReadonlyMap<number, PublishPageQualityInput>;
  minPassScore: number;
  publishRecords: ReadonlyArray<PublishPageRecordInput>;
  publishTasks: ReadonlyArray<PublishPageTaskInput>;
  accountGroups: ReadonlyArray<PublishPageAccountGroupInput>;
}): PublishPagePlatformCard[] {
  const articlesByPlatform = new Map<PublishPagePlatformKey, PublishPageArticleInput[]>();
  for (const article of input.articles) {
    const key = articlePlatformKey(article);
    const list = articlesByPlatform.get(key as PublishPagePlatformKey) ?? [];
    list.push(article);
    articlesByPlatform.set(key as PublishPagePlatformKey, list);
  }

  const tasksByPlatform = new Map<PublishPagePlatformKey, PublishPageTaskInput[]>();
  for (const task of input.publishTasks) {
    const key = taskPlatformKey(task.platform);
    if (!key) continue;
    const list = tasksByPlatform.get(key) ?? [];
    list.push(task);
    tasksByPlatform.set(key, list);
  }

  const recordsByPlatform = new Map<PublishPagePlatformKey, PublishPageRecordInput[]>();
  for (const record of input.publishRecords) {
    const key = channelToPlatformKey(record.publishChannel);
    if (!key) continue;
    const list = recordsByPlatform.get(key) ?? [];
    list.push(record);
    recordsByPlatform.set(key, list);
  }

  const boundByPlatform = new Map<string, boolean>();
  for (const group of input.accountGroups) {
    boundByPlatform.set(group.platform, (group.accounts ?? []).length > 0);
  }

  return PUBLISH_PAGE_PLATFORM_ORDER.map(key => {
    const label = PUBLISH_PAGE_PLATFORM_LABELS[key];
    const manualOnly = key === "xiaohongshu" || key === "wechat" || key === "other";
    const bindingSlug = key === "other" ? null : (key as BindingPublishPlatform);
    const bound =
      key === "other"
        ? false
        : bindingSlug
          ? Boolean(boundByPlatform.get(bindingSlug))
          : manualOnly;

    const platformArticles = articlesByPlatform.get(key) ?? [];
    const latestArticle = platformArticles[0] ?? null;
    const weeklyTitlePreview =
      latestArticle?.title?.trim() ||
      platformArticles.find(a => a.title?.trim())?.title?.trim() ||
      null;

    const platformTasks = [...(tasksByPlatform.get(key) ?? [])].sort(
      (a, b) => (parseTime(b.createdAt) ?? 0) - (parseTime(a.createdAt) ?? 0),
    );
    const latestTask = platformTasks[0] ?? null;
    const platformRecords = [...(recordsByPlatform.get(key) ?? [])].sort(
      (a, b) => (parseTime(b.publishedAt) ?? 0) - (parseTime(a.publishedAt) ?? 0),
    );
    const latestRecord = platformRecords[0] ?? null;

    const articleId = latestArticle?.id ?? latestTask?.articleId ?? latestRecord?.articleId ?? null;
    const q = articleId != null ? input.qualityByArticleId.get(articleId) : undefined;
    const qualityPass = isQualityPassed(q, input.minPassScore);
    const resolved =
      latestArticle != null
        ? getArticlePublishPlatform({
            generationBasis: latestArticle.generationBasis ?? null,
            targetPlatform: latestArticle.targetPlatform,
            publishPlatform: latestArticle.publishPlatform,
          })
        : null;

    let status: PublishPagePlatformStatus;
    let failureReason: string | null = null;
    let taskId: number | null = latestTask?.id ?? null;
    let recordId: number | null = latestRecord?.id ?? null;

    if (manualOnly && !bindingSlug) {
      status = "manual_only";
    } else if (!manualOnly && !bound) {
      status = "not_bound";
    } else if (latestTask?.status === "failed") {
      status = "failed";
      const agentFailure = customerMessageForAgentPublishFailure(
        latestTask.agentErrorMessage,
        latestTask.agentErrorType,
      );
      failureReason =
        agentFailure && agentFailure !== "发布失败，请重试或联系支持"
          ? agentFailure
          : latestTask.agentErrorType?.trim()
            ? customerMessageForPublishError(latestTask.agentErrorType)
            : agentFailure ?? "发布失败，请重试或联系支持";
    } else if (latestTask && IN_FLIGHT_TASK_STATUSES.has(latestTask.status)) {
      status = "publishing";
    } else if (
      latestRecord?.publishStatus === "published" ||
      latestRecord?.publishStatus === "link_backfilled" ||
      latestArticle?.status === "已发布"
    ) {
      status = "published";
    } else if (!weeklyTitlePreview) {
      status = "no_content";
    } else if (!qualityPass) {
      status = "pending_confirm";
    } else {
      status = "ready";
    }

    const previewUrl =
      latestTask?.draftUrl?.trim() ||
      latestTask?.resultUrl?.trim() ||
      null;

    const canRetry = Boolean(
      latestTask?.status === "failed" &&
        (latestTask.canRetry ?? !latestTask.retryExhausted),
    );

    return {
      key,
      label,
      bound: manualOnly ? true : bound,
      manualOnly,
      weeklyTitlePreview,
      articleId,
      status,
      statusLabel: statusLabelFor(status, latestTask?.status),
      failureReason,
      taskId,
      recordId,
      previewUrl,
      canPreview: Boolean(previewUrl || articleId != null),
      canPublish: status === "ready" && articleId != null && !manualOnly && Boolean(resolved?.publishQueueSlug),
      canRetry,
      publishQueueSlug: resolved?.publishQueueSlug ?? (bindingSlug && key !== "other" ? bindingSlug : null),
    };
  });
}

export function publishPagePlatformLabel(key: PublishPagePlatformKey): string {
  return PUBLISH_PAGE_PLATFORM_LABELS[key];
}

export function bindingLabelForPlatform(key: BindingPublishPlatform): string {
  return PUBLISH_PLATFORM_LABELS[key];
}
