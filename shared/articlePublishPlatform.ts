import {
  isBindingPublishPlatform,
  PUBLISH_PLATFORM_LABELS,
  type BindingPublishPlatform,
} from "./platformAccountVerify";
import {
  getPlatformRule,
  isPublishPlatformId,
  PLATFORM_CONTENT_RULES,
  type PublishPlatformId,
} from "./platformContentRules";
/** 与 weeklyPlatformBoard.WEEKLY_PLATFORM_DEFS 对齐 */
export type WeeklyPlatformKey = "xiaohongshu" | "zhihu" | "sohu" | "netease" | "wechat" | "other";

/** 文章发布平台解析结果（生成 → 列表 → 弹窗 → 发布队列 → Local Agent 共用） */
export type ArticlePublishPlatformSlug =
  | PublishPlatformId
  | "xiaohongshu"
  | "wechat"
  | "unknown";

export type ResolvedArticlePublishPlatform = {
  slug: ArticlePublishPlatformSlug;
  label: string;
  weeklyPlatformKey: WeeklyPlatformKey;
  /** publishTasks.create 入参 platform（绑定平台或 wechat） */
  publishQueueSlug: BindingPublishPlatform | "wechat" | null;
  /** Local Agent 可自动发布（zhihu/sohu/toutiao/baijiahao） */
  supportedByLocalAgent: boolean;
  /** 已从文章/策略识别出平台（非 unknown） */
  recognized: boolean;
  /** 不可加入队列时的客户可读原因 */
  queueBlockedReason: string | null;
};

export type ArticlePublishPlatformSource = {
  targetPlatform?: string | null;
  publishPlatform?: string | null;
  /** 优化任务卡片推荐平台（列表接口已合并进 targetPlatform，读档/审计可单独传入） */
  taskRecommendedPlatform?: string | null;
  generationBasis?: Record<string, unknown> | null;
  lifecycle?: { platform?: string | null } | null;
};

const LOCAL_AGENT_AUTO_PUBLISH_PLATFORMS = new Set<BindingPublishPlatform>(["zhihu", "sohu", "toutiao", "baijiahao"]);

function weeklyKeyFromPublishId(id: PublishPlatformId): WeeklyPlatformKey {
  if (id === "netease") return "netease";
  if (id === "zhihu") return "zhihu";
  if (id === "sohu") return "sohu";
  if (id === "toutiao" || id === "baijiahao") return "other";
  return "other";
}

function labelForSlug(slug: ArticlePublishPlatformSlug): string {
  if (slug === "unknown") return "未知平台";
  if (slug === "xiaohongshu") return "小红书";
  if (slug === "wechat") return "公众号";
  if (isPublishPlatformId(slug)) return getPlatformRule(slug).label;
  return slug;
}

/** 将任意平台文本规范为统一 slug + 展示名 */
export function normalizePublishPlatform(input: string | null | undefined): ResolvedArticlePublishPlatform {
  const raw = (input ?? "").trim();
  if (!raw) {
    return {
      slug: "unknown",
      label: "未知平台",
      weeklyPlatformKey: "other",
      publishQueueSlug: null,
      supportedByLocalAgent: false,
      recognized: false,
      queueBlockedReason:
        "暂未识别本篇发布平台。请返回内容策略中选择平台后重新生成，或手动指定发布平台。",
    };
  }

  const lower = raw.toLowerCase();

  if (lower.includes("小红书") || lower.includes("xiaohongshu") || lower === "redbook") {
    return finalizeResolved("xiaohongshu");
  }
  if (lower.includes("公众号") || lower.includes("微信") || lower === "wechat") {
    return finalizeResolved("wechat");
  }
  if (isPublishPlatformId(lower)) {
    return finalizeResolved(lower);
  }
  if (lower.includes("知乎") || lower === "zhihu") {
    return finalizeResolved("zhihu");
  }
  if (lower.includes("搜狐") || lower === "sohu") {
    return finalizeResolved("sohu");
  }
  if (lower.includes("网易") || lower === "netease") {
    return finalizeResolved("netease");
  }
  if (lower.includes("头条") || lower === "toutiao") {
    return finalizeResolved("toutiao");
  }
  if (lower.includes("百家") || lower === "baijiahao") {
    return finalizeResolved("baijiahao");
  }

  for (const id of Object.keys(PLATFORM_CONTENT_RULES) as PublishPlatformId[]) {
    const rule = PLATFORM_CONTENT_RULES[id];
    if (raw.includes(rule.label) || raw === rule.materialKey) {
      return finalizeResolved(id);
    }
  }

  return {
    slug: "unknown",
    label: raw,
    weeklyPlatformKey: "other",
    publishQueueSlug: null,
    supportedByLocalAgent: false,
    recognized: false,
    queueBlockedReason:
      "暂未识别本篇发布平台。请返回内容策略中选择平台后重新生成，或手动指定发布平台。",
  };
}

function finalizeResolved(slug: Exclude<ArticlePublishPlatformSlug, "unknown">): ResolvedArticlePublishPlatform {
  const label = labelForSlug(slug);
  if (slug === "xiaohongshu") {
    return {
      slug,
      label,
      weeklyPlatformKey: "xiaohongshu",
      publishQueueSlug: null,
      supportedByLocalAgent: false,
      recognized: true,
      queueBlockedReason:
        "本篇内容识别为「小红书」，当前本地客户端暂不支持自动发布，请先选择人工发布或后续接入。",
    };
  }
  if (slug === "wechat") {
    return {
      slug,
      label,
      weeklyPlatformKey: "wechat",
      publishQueueSlug: "wechat",
      supportedByLocalAgent: false,
      recognized: true,
      queueBlockedReason: "本篇内容识别为「公众号」，请使用资产发布记录人工登记发布结果。",
    };
  }
  const publishId = slug as PublishPlatformId;
  const weeklyPlatformKey = weeklyKeyFromPublishId(publishId);
  const publishQueueSlug: BindingPublishPlatform | null = isBindingPublishPlatform(publishId) ? publishId : null;
  const supportedByLocalAgent = LOCAL_AGENT_AUTO_PUBLISH_PLATFORMS.has(publishId);
  let queueBlockedReason: string | null = null;
  if (publishId === "netease") {
    queueBlockedReason =
      "本篇内容识别为「网易号」，当前本地客户端暂不支持自动发布，请先选择人工发布或后续接入。";
  } else if (!supportedByLocalAgent && publishQueueSlug) {
    queueBlockedReason = `本篇内容识别为「${label}」，当前本地客户端发布能力待验证，请确认账号绑定后再试。`;
  }
  return {
    slug: publishId,
    label,
    weeklyPlatformKey,
    publishQueueSlug,
    supportedByLocalAgent,
    recognized: true,
    queueBlockedReason,
  };
}

function readPlatformFromGenerationBasis(basis?: Record<string, unknown> | null): string | null {
  const ps = basis?.platformContentStrategy;
  if (!ps || typeof ps !== "object") return null;
  const meta = ps as Record<string, unknown>;
  if (typeof meta.targetPublishPlatform === "string" && meta.targetPublishPlatform.trim()) {
    return meta.targetPublishPlatform.trim();
  }
  if (typeof meta.targetPublishPlatformLabel === "string" && meta.targetPublishPlatformLabel.trim()) {
    return meta.targetPublishPlatformLabel.trim();
  }
  return null;
}

/** 按优先级从文章记录解析发布平台 */
export function getArticlePublishPlatform(article: ArticlePublishPlatformSource): ResolvedArticlePublishPlatform {
  const candidates: Array<string | null | undefined> = [
    readPlatformFromGenerationBasis(article.generationBasis),
    article.publishPlatform,
    article.targetPlatform,
    article.taskRecommendedPlatform,
    typeof article.lifecycle?.platform === "string" ? article.lifecycle.platform : null,
  ];
  for (const c of candidates) {
    const resolved = normalizePublishPlatform(c);
    if (resolved.recognized) return resolved;
  }
  return normalizePublishPlatform(null);
}

/** 旧文章无平台字段时，允许用发布队列入参平台兜底（不修改库表） */
export function resolveEffectiveArticlePublishPlatform(
  article: ArticlePublishPlatformSource,
  requestedPlatform?: BindingPublishPlatform | null,
): ResolvedArticlePublishPlatform {
  const fromArticle = getArticlePublishPlatform(article);
  if (fromArticle.recognized) return fromArticle;
  if (requestedPlatform && isBindingPublishPlatform(requestedPlatform)) {
    return normalizePublishPlatform(requestedPlatform);
  }
  return fromArticle;
}

export function resolveArticleListPublishFields(input: {
  generationBasis?: Record<string, unknown> | null;
  taskRecommendedPlatform?: string | null;
  articleType?: string | null;
}): { targetPlatform: string | null; publishPlatform: PublishPlatformId | null } {
  const fromBasis = readPlatformFromGenerationBasis(input.generationBasis);
  const resolved = normalizePublishPlatform(fromBasis ?? input.taskRecommendedPlatform ?? input.articleType);
  const publishPlatform = isPublishPlatformId(resolved.slug) ? resolved.slug : null;
  return {
    targetPlatform: resolved.recognized ? resolved.label : input.taskRecommendedPlatform?.trim() || null,
    publishPlatform,
  };
}

export function publishPlatformLabel(slug: BindingPublishPlatform): string {
  return PUBLISH_PLATFORM_LABELS[slug];
}
