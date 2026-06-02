import {
  getArticlePublishPlatform,
  resolveEffectiveArticlePublishPlatform,
  type ArticlePublishPlatformSlug,
  type ArticlePublishPlatformSource,
  type ResolvedArticlePublishPlatform,
} from "./articlePublishPlatform";
import {
  getContentQualityGateStatus,
  type ContentQualityGateArticle,
} from "./contentQualityGate";
import { isGeoQualityScoreStale } from "./geoQualityStale";
import {
  formatGeoProfileIncompleteMessage,
  evaluateGeoProfileP0Readiness,
} from "./geoProfileP0Readiness";
import {
  isBindingPublishPlatform,
  PUBLISH_PLATFORM_LABELS,
  type BindingPublishPlatform,
} from "./platformAccountVerify";
type LocalAgentAccountStatusEntry = {
  platform: string;
  profileId: string;
  displayName: string | null;
  displayNameVerified: boolean;
  loginStatus: "valid" | "invalid" | "unknown";
  lastCheckedAt: string;
};

export type PublishReadinessBlockingCode =
  | "PROJECT_INACCESSIBLE"
  | "PROFILE_INCOMPLETE"
  | "DIAGNOSIS_REQUIRED"
  | "ARTICLE_MISSING"
  | "PLATFORM_UNKNOWN"
  | "PLATFORM_UNSUPPORTED"
  | "QUALITY_MISSING"
  | "QUALITY_FAILED"
  | "QUALITY_STALE"
  | "QUALITY_UNKNOWN"
  | "LOCAL_AGENT_DISCONNECTED"
  | "PLATFORM_ACCOUNT_UNBOUND"
  | "ACCOUNT_STATUS_NOT_SYNCED"
  | null;

export type PublishReadinessNextActionTarget =
  | "go_profile"
  | "go_diagnosis"
  | "generate_content"
  | "quality_check"
  | "open_local_agent"
  | "open_local_agent_accounts"
  | "refresh_agent_status"
  | "manual_publish"
  | "create_publish_task"
  | null;

export type PublishReadinessPlatform = ArticlePublishPlatformSlug;

export type PublishReadyAccountRow = {
  platform: string;
  accountName?: string | null;
  isEnabled?: boolean | number | null;
  localProfileId?: string | null;
  localAgentId?: string | null;
  sessionStatus?: string | null;
};

export type PublishReadinessArticle = ContentQualityGateArticle &
  Omit<ArticlePublishPlatformSource, "lifecycle"> & {
    lifecycle?: unknown;
  };

export type PublishReadinessInput = {
  projectAccessible?: boolean;
  enterpriseProfileReady?: boolean;
  /** 企业档案原始记录（用于 PROFILE_INCOMPLETE 缺失项文案） */
  enterpriseProfile?: Record<string, unknown> | null;
  diagnosisReady?: boolean;
  article?: PublishReadinessArticle | null;
  localAgentConnected?: boolean | null;
  /** 当前项目下启用账号（可按平台过滤） */
  platformAccounts?: PublishReadyAccountRow[];
  /** 服务端 create 入参平台；缺省则用文章解析结果 */
  requestedPlatform?: BindingPublishPlatform | null;
  /** 服务端跳过 Local Agent 在线检测 */
  skipLocalAgentConnectionCheck?: boolean;
  /** 本地客户端已检测为 valid、但尚未写入 Web 的账号摘要（由 Web 拉取 /accounts 后传入） */
  localAgentAccountSnapshot?: LocalAgentAccountStatusEntry[];
};

export type PublishReadinessResult = {
  ready: boolean;
  blockingCode: PublishReadinessBlockingCode;
  message: string;
  nextActionLabel: string;
  nextActionTarget: PublishReadinessNextActionTarget;
  platform: PublishReadinessPlatform;
  platformLabel: string;
  debugReasons: string[];
  resolvedPlatform: ResolvedArticlePublishPlatform | null;
};

const MESSAGES = {
  projectInaccessible: "当前企业项目不存在或无访问权限，请重新进入项目后再试。",
  profileIncomplete: "企业建档未完成，请先补全品牌资产建档。",
  /** 由 formatGeoProfileIncompleteMessage 动态生成 */
  diagnosisRequired: "请先完成 AI 实测诊断并生成优化任务。",
  articleMissing: "请先生成平台内容。",
  platformUnknown:
    "暂未识别本篇发布平台。请在下方手动选择发布平台，或返回内容策略重新生成带平台标记的内容。",
  qualityMissing: "当前内容尚未进行发布前质检，请先质检后发布。",
  qualityFailed: "当前内容未通过发布前质检，请先修改并重新质检。",
  qualityStale: "当前内容编辑后尚未重新质检，请重新质检后发布。",
  qualityUnknown: "当前内容质检状态不明确，请刷新或重新质检。",
  localAgentDisconnected: "请先打开 GEO 本地发布客户端，并刷新连接状态。",
} as const;

export function isPublishReadyPlatformAccount(row: PublishReadyAccountRow): boolean {
  const enabled = row.isEnabled === true || row.isEnabled === 1;
  return (
    enabled &&
    Boolean(row.accountName?.trim()) &&
    Boolean(row.localProfileId?.trim()) &&
    Boolean(row.localAgentId?.trim()) &&
    row.sessionStatus === "active"
  );
}

function platformUnsupportedMessage(label: string): string {
  return `本篇内容识别为「${label}」，当前本地客户端即将支持该平台发布，请先人工发布或等待支持。`;
}

function platformAccountUnboundMessage(label: string): string {
  return `尚未绑定「${label}」发布账号。请在本地发布客户端的「账号环境」中创建并登录${label}账号。`;
}

function accountStatusNotSyncedMessage(label: string): string {
  return `本地客户端已连接，但尚未同步到「${label}」账号状态。请在客户端点击重新检测，或在 Web 点击刷新账号状态。`;
}

function resolveQualityBlock(
  article: ContentQualityGateArticle,
  debugReasons: string[],
): Pick<PublishReadinessResult, "blockingCode" | "message" | "nextActionLabel" | "nextActionTarget"> | null {
  if (isGeoQualityScoreStale(article)) {
    debugReasons.push("geoQualityStale");
    return {
      blockingCode: "QUALITY_STALE",
      message: MESSAGES.qualityStale,
      nextActionLabel: "重新质检",
      nextActionTarget: "quality_check",
    };
  }
  const gate = getContentQualityGateStatus(article);
  if (gate.passed) return null;
  if (gate.reason === "missing") {
    debugReasons.push("quality:missing");
    return {
      blockingCode: "QUALITY_MISSING",
      message: MESSAGES.qualityMissing,
      nextActionLabel: "去质检",
      nextActionTarget: "quality_check",
    };
  }
  if (gate.reason === "failed") {
    debugReasons.push("quality:failed");
    return {
      blockingCode: "QUALITY_FAILED",
      message: MESSAGES.qualityFailed,
      nextActionLabel: "修改并重新质检",
      nextActionTarget: "quality_check",
    };
  }
  debugReasons.push(`quality:${gate.reason}`);
  return {
    blockingCode: "QUALITY_UNKNOWN",
    message: MESSAGES.qualityUnknown,
    nextActionLabel: "刷新或重新质检",
    nextActionTarget: "quality_check",
  };
}

function countReadyAccountsForPlatform(
  accounts: PublishReadyAccountRow[] | undefined,
  platform: BindingPublishPlatform,
): number {
  return (accounts ?? []).filter(a => a.platform === platform && isPublishReadyPlatformAccount(a)).length;
}

function filterValidLocalAgentPlatforms(entries: LocalAgentAccountStatusEntry[]): BindingPublishPlatform[] {
  const out = new Set<BindingPublishPlatform>();
  for (const row of entries) {
    if (row.loginStatus !== "valid") continue;
    if (!isBindingPublishPlatform(row.platform)) continue;
    out.add(row.platform);
  }
  return Array.from(out);
}

function blocked(
  partial: Omit<PublishReadinessResult, "ready" | "debugReasons" | "resolvedPlatform"> & {
    debugReasons?: string[];
    resolvedPlatform?: ResolvedArticlePublishPlatform | null;
  },
): PublishReadinessResult {
  return {
    ready: false,
    debugReasons: partial.debugReasons ?? [],
    resolvedPlatform: partial.resolvedPlatform ?? null,
    blockingCode: partial.blockingCode,
    message: partial.message,
    nextActionLabel: partial.nextActionLabel,
    nextActionTarget: partial.nextActionTarget,
    platform: partial.platform,
    platformLabel: partial.platformLabel,
  };
}

function readyResult(
  platform: PublishReadinessPlatform,
  platformLabel: string,
  resolvedPlatform: ResolvedArticlePublishPlatform,
  debugReasons: string[],
): PublishReadinessResult {
  return {
    ready: true,
    blockingCode: null,
    message: "",
    nextActionLabel: "加入发布队列",
    nextActionTarget: "create_publish_task",
    platform,
    platformLabel,
    debugReasons,
    resolvedPlatform,
  };
}

/** 统一发布前准备状态机（Web / API 共用） */
export function evaluatePublishReadiness(input: PublishReadinessInput): PublishReadinessResult {
  const debugReasons: string[] = [];
  const emptyPlatform: PublishReadinessPlatform = "unknown";

  if (input.projectAccessible === false) {
    debugReasons.push("projectAccessible=false");
    return blocked({
      blockingCode: "PROJECT_INACCESSIBLE",
      message: MESSAGES.projectInaccessible,
      nextActionLabel: "返回项目列表",
      nextActionTarget: null,
      platform: emptyPlatform,
      platformLabel: "未知平台",
      debugReasons,
    });
  }

  if (input.enterpriseProfileReady === false) {
    const p0 = evaluateGeoProfileP0Readiness(input.enterpriseProfile ?? null);
    debugReasons.push("enterpriseProfileReady=false", ...p0.missingLabels.map(l => `missing:${l}`));
    return blocked({
      blockingCode: "PROFILE_INCOMPLETE",
      message: formatGeoProfileIncompleteMessage(p0.missingLabels),
      nextActionLabel: "补全品牌建档",
      nextActionTarget: "go_profile",
      platform: emptyPlatform,
      platformLabel: "未知平台",
      debugReasons,
    });
  }

  if (input.diagnosisReady === false) {
    debugReasons.push("diagnosisReady=false");
    return blocked({
      blockingCode: "DIAGNOSIS_REQUIRED",
      message: MESSAGES.diagnosisRequired,
      nextActionLabel: "去 AI 实测诊断",
      nextActionTarget: "go_diagnosis",
      platform: emptyPlatform,
      platformLabel: "未知平台",
      debugReasons,
    });
  }

  if (!input.article) {
    debugReasons.push("article=null");
    return blocked({
      blockingCode: "ARTICLE_MISSING",
      message: MESSAGES.articleMissing,
      nextActionLabel: "生成平台内容",
      nextActionTarget: "generate_content",
      platform: emptyPlatform,
      platformLabel: "未知平台",
      debugReasons,
    });
  }

  const resolved = resolveEffectiveArticlePublishPlatform(
    input.article as ArticlePublishPlatformSource,
    input.requestedPlatform ?? null,
  );
  const platform = resolved.slug;
  const platformLabel = resolved.label;

  if (!resolved.recognized) {
    debugReasons.push("platform:unknown");
    return blocked({
      blockingCode: "PLATFORM_UNKNOWN",
      message: resolved.queueBlockedReason ?? MESSAGES.platformUnknown,
      nextActionLabel: "手动指定发布平台",
      nextActionTarget: null,
      platform,
      platformLabel,
      debugReasons,
      resolvedPlatform: resolved,
    });
  }

  const unsupported =
    platform === "xiaohongshu" ||
    platform === "wechat" ||
    (platform === "netease" && !resolved.supportedByLocalAgent) ||
    Boolean(resolved.queueBlockedReason && !resolved.supportedByLocalAgent);

  if (unsupported) {
    debugReasons.push(`platform:unsupported:${platform}`);
    return blocked({
      blockingCode: "PLATFORM_UNSUPPORTED",
      message: resolved.queueBlockedReason ?? platformUnsupportedMessage(platformLabel),
      nextActionLabel: "人工发布登记",
      nextActionTarget: "manual_publish",
      platform,
      platformLabel,
      debugReasons,
      resolvedPlatform: resolved,
    });
  }

  const qualityBlock = resolveQualityBlock(input.article, debugReasons);
  if (qualityBlock) {
    return blocked({
      ...qualityBlock,
      platform,
      platformLabel,
      debugReasons,
      resolvedPlatform: resolved,
    });
  }

  if (!input.skipLocalAgentConnectionCheck && input.localAgentConnected === false) {
    debugReasons.push("localAgentConnected=false");
    return blocked({
      blockingCode: "LOCAL_AGENT_DISCONNECTED",
      message: MESSAGES.localAgentDisconnected,
      nextActionLabel: "打开本地客户端",
      nextActionTarget: "open_local_agent",
      platform,
      platformLabel,
      debugReasons,
      resolvedPlatform: resolved,
    });
  }

  const publishSlug =
    input.requestedPlatform ??
    (resolved.publishQueueSlug && isBindingPublishPlatform(resolved.publishQueueSlug)
      ? resolved.publishQueueSlug
      : null);

  if (!publishSlug || !isBindingPublishPlatform(publishSlug)) {
    debugReasons.push("platform:not-bindable");
    return blocked({
      blockingCode: "PLATFORM_UNSUPPORTED",
      message: resolved.queueBlockedReason ?? platformUnsupportedMessage(platformLabel),
      nextActionLabel: "人工发布登记",
      nextActionTarget: "manual_publish",
      platform,
      platformLabel,
      debugReasons,
      resolvedPlatform: resolved,
    });
  }

  const readyCount = countReadyAccountsForPlatform(input.platformAccounts, publishSlug);
  const localValidPlatforms = filterValidLocalAgentPlatforms(input.localAgentAccountSnapshot ?? []);
  const localHasValid = localValidPlatforms.includes(publishSlug);
  if (readyCount === 0) {
    const label = PUBLISH_PLATFORM_LABELS[publishSlug] ?? platformLabel;
    if (input.localAgentConnected === true && localHasValid) {
      debugReasons.push(`platformAccount:local_valid:${publishSlug}`);
      return readyResult(platform, label, resolved, debugReasons);
    }
    if (input.localAgentConnected === true && Array.isArray(input.localAgentAccountSnapshot) && input.localAgentAccountSnapshot.length === 0) {
      debugReasons.push(`platformAccount:not_synced_empty:${publishSlug}`);
      return blocked({
        blockingCode: "ACCOUNT_STATUS_NOT_SYNCED",
        message: accountStatusNotSyncedMessage(label),
        nextActionLabel: "刷新账号状态",
        nextActionTarget: "refresh_agent_status",
        platform,
        platformLabel: label,
        debugReasons,
        resolvedPlatform: resolved,
      });
    }
    if (input.localAgentConnected === true && (input.localAgentAccountSnapshot?.length ?? 0) > 0 && !localHasValid) {
      debugReasons.push(`platformAccount:not_synced:${publishSlug}`);
      return blocked({
        blockingCode: "ACCOUNT_STATUS_NOT_SYNCED",
        message: accountStatusNotSyncedMessage(label),
        nextActionLabel: "刷新账号状态",
        nextActionTarget: "refresh_agent_status",
        platform,
        platformLabel: label,
        debugReasons,
        resolvedPlatform: resolved,
      });
    }
    debugReasons.push(`platformAccount:unbound:${publishSlug}`);
    return blocked({
      blockingCode: "PLATFORM_ACCOUNT_UNBOUND",
      message: platformAccountUnboundMessage(label),
      nextActionLabel: "打开本地客户端账号环境",
      nextActionTarget: "open_local_agent_accounts",
      platform,
      platformLabel: label,
      debugReasons,
      resolvedPlatform: resolved,
    });
  }

  debugReasons.push("ready");
  return readyResult(platform, platformLabel, resolved, debugReasons);
}

/** 工作台级风险提醒（无具体文章时） */
export function buildWorkspacePublishRiskHints(input: {
  p0ProfileComplete: boolean;
  boundPublishAccountCount: number;
  localAgentOnline: boolean | null | undefined;
}): string[] {
  const hints: string[] = [];
  if (!input.p0ProfileComplete) {
    hints.push(MESSAGES.profileIncomplete);
  }
  if (input.boundPublishAccountCount === 0) {
    if (input.localAgentOnline === false) {
      hints.push(MESSAGES.localAgentDisconnected);
    } else {
      hints.push(
        "尚未在本地发布客户端配置可发布账号。请打开客户端「账号环境」创建并登录，再返回本页刷新状态。",
      );
    }
  } else if (input.localAgentOnline === false) {
    hints.push(MESSAGES.localAgentDisconnected);
  }
  return hints;
}

/** 文章级风险提醒（与弹窗 blockingCode 一致） */
export function publishReadinessRiskHint(result: PublishReadinessResult): string | null {
  if (result.ready) return null;
  return result.message;
}
