/**
 * 内容资产生命周期（GEO-P0-B）
 * 与 legacy `geo_articles.status`（中文枚举）并存；发布终态以 lifecycleStatus 为准。
 */

export const ARTICLE_LIFECYCLE_STATUSES = [
  "generated",
  "quality_checked",
  "confirmed",
  "pending_publish",
  "agent_processing",
  "manual_required",
  "draft_saved",
  "published",
  "failed",
  "needs_revision",
] as const;

export type ArticleLifecycleStatus = (typeof ARTICLE_LIFECYCLE_STATUSES)[number];

export type ArticleLifecycleEvent = {
  status: ArticleLifecycleStatus;
  at: string;
  source: string;
  message?: string;
  taskId?: number;
  platform?: string;
  publishTaskStatus?: string;
};

export const ARTICLE_LIFECYCLE_LABELS: Record<ArticleLifecycleStatus, string> = {
  generated: "已生成",
  quality_checked: "质检已通过",
  confirmed: "已确认可发布",
  pending_publish: "待本地 Agent 发布",
  agent_processing: "Agent 执行中",
  manual_required: "需人工确认保存",
  draft_saved: "平台草稿已保存",
  published: "已发布",
  failed: "发布失败",
  needs_revision: "待修订",
};

export const ARTICLE_LIFECYCLE_NEXT_ACTION: Record<ArticleLifecycleStatus, string> = {
  generated: "执行内容质检或打开编辑确认正文",
  quality_checked: "保存编辑确认内容，或创建知乎发布任务",
  confirmed: "在内容资产页选择账号并「发布到平台」",
  pending_publish: "打开本地发布客户端并开始轮询任务",
  agent_processing: "等待本地 Agent 填稿完成",
  manual_required: "在知乎窗口确认保存草稿，并查看发布任务状态",
  draft_saved: "在平台确认草稿并回填发布记录",
  published: "进入资产发布记录查看链接与后续复测",
  failed: "检查失败原因，修订内容后重新创建发布任务",
  needs_revision: "根据质检/审核意见修改后重新质检",
};

export function isArticleLifecycleStatus(value: string): value is ArticleLifecycleStatus {
  return (ARTICLE_LIFECYCLE_STATUSES as readonly string[]).includes(value);
}

/** 禁止无 publicUrl / 任务证据时将 manual_required 展示为已发布 */
export function isFakePublishedLifecycle(input: {
  lifecycleStatus?: string | null;
  legacyStatus?: string | null;
  publicPath?: string | null;
}): boolean {
  if (input.lifecycleStatus === "published") {
    return !input.publicPath?.trim();
  }
  if (input.lifecycleStatus === "manual_required" || input.lifecycleStatus === "draft_saved") {
    return input.legacyStatus === "已发布";
  }
  return false;
}

export function parseLifecycleEvents(raw: unknown): ArticleLifecycleEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: ArticleLifecycleEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const status = typeof o.status === "string" ? o.status : "";
    if (!isArticleLifecycleStatus(status)) continue;
    const at = typeof o.at === "string" ? o.at : new Date().toISOString();
    const source = typeof o.source === "string" ? o.source : "unknown";
    out.push({
      status,
      at,
      source,
      message: typeof o.message === "string" ? o.message : undefined,
      taskId: typeof o.taskId === "number" ? o.taskId : undefined,
      platform: typeof o.platform === "string" ? o.platform : undefined,
      publishTaskStatus: typeof o.publishTaskStatus === "string" ? o.publishTaskStatus : undefined,
    });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export function latestLifecycleEvent(events: ArticleLifecycleEvent[]): ArticleLifecycleEvent | null {
  if (events.length === 0) return null;
  return events[events.length - 1]!;
}

/** 无 lifecycle 列时的 legacy 中文 status 推断（只读展示，不写库） */
export function inferLifecycleFromLegacyStatus(legacyStatus: string): ArticleLifecycleStatus {
  switch (legacyStatus) {
    case "已发布":
    case "待复测":
      return "published";
    case "质检未通过":
    case "审核未通过":
      return "needs_revision";
    case "需人工审核":
      return "needs_revision";
    case "审核通过":
    case "待审核":
      return "confirmed";
    case "质检通过":
      return "quality_checked";
    case "已生成":
    case "待质检":
    default:
      return "generated";
  }
}

export function resolveArticleLifecycleView(article: {
  lifecycleStatus?: string | null;
  lifecycleEvents?: unknown;
  status?: string | null;
  publicPath?: string | null;
}): {
  status: ArticleLifecycleStatus;
  label: string;
  nextAction: string;
  events: ArticleLifecycleEvent[];
  latestEvent: ArticleLifecycleEvent | null;
  fakePublished: boolean;
} {
  const events = parseLifecycleEvents(article.lifecycleEvents);
  const status = article.lifecycleStatus && isArticleLifecycleStatus(article.lifecycleStatus)
    ? article.lifecycleStatus
    : inferLifecycleFromLegacyStatus(article.status ?? "已生成");
  const fakePublished = isFakePublishedLifecycle({
    lifecycleStatus: status,
    legacyStatus: article.status,
    publicPath: article.publicPath,
  });
  return {
    status,
    label: ARTICLE_LIFECYCLE_LABELS[status],
    nextAction: ARTICLE_LIFECYCLE_NEXT_ACTION[status],
    events,
    latestEvent: latestLifecycleEvent(events),
    fakePublished,
  };
}
