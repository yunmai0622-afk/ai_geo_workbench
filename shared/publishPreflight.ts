/**
 * GEO-V1.1 统一发布前检查：卡片 / 弹窗 / publishTasks.create 共用同一状态源
 */

import { resolveEffectiveArticlePublishPlatform, type ResolvedArticlePublishPlatform } from "./articlePublishPlatform";
import { articleHasPublishableCover, type ArticleCoverSource } from "./articleCoverReadiness";
import { getUnifiedQualityGateStatus, type ContentQualityGateArticle } from "./contentQualityGate";
import { isGeoQualityScoreStale } from "./geoQualityStale";
import {
  filterValidLocalAgentPlatforms,
  isLocalAgentAccountEntryValid,
  type LocalAgentAccountStatusEntry,
} from "./localAgentAccountSync";
import {
  isBindingPublishPlatform,
  PUBLISH_PLATFORM_LABELS,
  publishBlockedSessionExpiredMessage,
  type BindingPublishPlatform,
} from "./platformAccountVerify";
import {
  countPublishTitleChars,
  evaluatePrePublishChecklist,
  getPublishPlatformMinBodyChars,
  getPublishPlatformTitleMaxChars,
  PRE_PUBLISH_COVER_OPTIONAL_PLATFORMS,
  type PrePublishChecklistPlatform,
} from "./publishPrePublishChecklist";
import { countMarkdownBodyChars } from "./platformDraftContentQuality";
import {
  evaluatePublishReadiness,
  isPublishReadyPlatformAccount,
  type PublishReadinessArticle,
  type PublishReadinessInput,
  type PublishReadinessResult,
  type PublishReadyAccountRow,
} from "./publishReadiness";

export type PublishPreflightCheckCode =
  | "LOCAL_AGENT_CONNECTED"
  | "PLATFORM_SUPPORTED"
  | "PLATFORM_ACCOUNT_VALID"
  | "COVER_READY"
  | "QUALITY_PASSED"
  | "ARTICLE_PLATFORM_MATCH"
  | "ARTICLE_BELONGS_TO_PROJECT"
  | "TITLE_WITHIN_LIMIT"
  | "BODY_MIN_LENGTH"
  | "WORKSPACE_READY";

export type PublishPreflightCheckStatus = "pass" | "warning" | "fail";

export type PublishPreflightCheck = {
  code: PublishPreflightCheckCode;
  label: string;
  status: PublishPreflightCheckStatus;
  message: string;
  action?: string;
};

export type LocalAgentStatusInput = {
  /** Local Agent 已与 GEO 服务端通信（DB 有 active 会话或近期同步） */
  serverHeartbeatConnected?: boolean | null;
  /** 浏览器本机 HTTP 探测 Local Agent 成功 */
  browserLocalAgentConnected?: boolean | null;
  /** Web 已拉取的本地客户端账号快照 */
  localAgentAccountSnapshot?: LocalAgentAccountStatusEntry[];
  /** 兼容旧字段：等同 browserLocalAgentConnected */
  localAgentConnected?: boolean | null;
};

export type PublishPreflightArticle = PublishReadinessArticle &
  ArticleCoverSource & {
    projectId?: number | null;
    title?: string | null;
    markdownContent?: string | null;
  };

export type EvaluatePublishPreflightInput = {
  projectId: number;
  article: PublishPreflightArticle | null | undefined;
  requestedPlatform?: BindingPublishPlatform | null;
  platformAccounts?: PublishReadyAccountRow[];
  localAgentStatus?: LocalAgentStatusInput;
  selectedAccount?: PublishReadyAccountRow | null;
  selectedAccountId?: number | null;
  qualityResult?: ContentQualityGateArticle | null;
  projectAccessible?: boolean;
  enterpriseProfileReady?: boolean;
  enterpriseProfile?: Record<string, unknown> | null;
  diagnosisReady?: boolean;
  skipLocalAgentConnectionCheck?: boolean;
};

export type PublishPreflightResult = {
  ready: boolean;
  checks: PublishPreflightCheck[];
  blockingCodes: PublishPreflightCheckCode[];
  selectedPlatform: BindingPublishPlatform | PrePublishChecklistPlatform | null;
  selectedAccountId?: number;
  canCreatePublishTask: boolean;
  readiness: PublishReadinessResult | null;
  platformLabel: string;
  resolvedPlatform: ResolvedArticlePublishPlatform | null;
};

function check(
  code: PublishPreflightCheckCode,
  label: string,
  status: PublishPreflightCheckStatus,
  message: string,
  action?: string,
): PublishPreflightCheck {
  return { code, label, status, message, action };
}

export function inferServerHeartbeatConnected(accounts: PublishReadyAccountRow[] | undefined): boolean {
  return (accounts ?? []).some(
    row =>
      Boolean(row.localAgentId?.trim()) &&
      Boolean(row.localProfileId?.trim()) &&
      row.sessionStatus === "active",
  );
}

function resolveBrowserConnected(status?: LocalAgentStatusInput): boolean | null {
  if (!status) return null;
  if (status.browserLocalAgentConnected != null) return status.browserLocalAgentConnected;
  return status.localAgentConnected ?? null;
}

function isPlatformAccountValidForPublish(input: {
  platform: BindingPublishPlatform;
  account?: PublishReadyAccountRow | null;
  platformAccounts?: PublishReadyAccountRow[];
  snapshot?: LocalAgentAccountStatusEntry[];
}): { valid: boolean; nicknameWarning: boolean } {
  const { platform, account, platformAccounts, snapshot } = input;
  if (account && isPublishReadyPlatformAccount({ ...account, platform })) {
    return { valid: true, nicknameWarning: false };
  }
  const dbReady = (platformAccounts ?? []).some(
    row => row.platform === platform && isPublishReadyPlatformAccount(row),
  );
  if (dbReady) return { valid: true, nicknameWarning: false };
  const snapshotValid = (snapshot ?? []).some(
    entry => entry.platform === platform && isLocalAgentAccountEntryValid(entry),
  );
  if (snapshotValid) return { valid: true, nicknameWarning: true };
  return { valid: false, nicknameWarning: false };
}

function isCoverRequired(platform: PrePublishChecklistPlatform): boolean {
  return !PRE_PUBLISH_COVER_OPTIONAL_PLATFORMS.includes(platform);
}

function mapReadinessToWorkspaceCheck(readiness: PublishReadinessResult): PublishPreflightCheck | null {
  if (readiness.ready) return null;
  const code = readiness.blockingCode ? mapReadinessToWorkspaceCheckCode(readiness) : "WORKSPACE_READY";
  return check(code, "发布前置条件", "fail", readiness.message, readiness.nextActionLabel);
}

function mapReadinessToWorkspaceCheckCode(readiness: PublishReadinessResult): PublishPreflightCheckCode {
  const bc = readiness.blockingCode;
  if (bc === "PLATFORM_UNKNOWN") return "ARTICLE_PLATFORM_MATCH";
  if (bc === "PLATFORM_UNSUPPORTED") return "PLATFORM_SUPPORTED";
  if (bc?.startsWith("QUALITY")) return "QUALITY_PASSED";
  if (bc === "LOCAL_AGENT_DISCONNECTED") return "LOCAL_AGENT_CONNECTED";
  if (bc === "PLATFORM_ACCOUNT_UNBOUND" || bc === "ACCOUNT_STATUS_NOT_SYNCED") return "PLATFORM_ACCOUNT_VALID";
  return "WORKSPACE_READY";
}

function buildLocalAgentCheck(input: {
  skip: boolean;
  platform: BindingPublishPlatform;
  platformLabel: string;
  status?: LocalAgentStatusInput;
  platformAccounts?: PublishReadyAccountRow[];
  accountValid: boolean;
}): PublishPreflightCheck {
  const label = "本地客户端已连接";
  if (input.skip) {
    return check("LOCAL_AGENT_CONNECTED", label, "pass", "服务端已跳过本机连接检测");
  }
  const browser = resolveBrowserConnected(input.status);
  const serverHeartbeat =
    input.status?.serverHeartbeatConnected ?? inferServerHeartbeatConnected(input.platformAccounts);
  const snapshot = input.status?.localAgentAccountSnapshot ?? [];
  const platformLabel = input.platformLabel;

  if (input.accountValid && browser === true) {
    return check(
      "LOCAL_AGENT_CONNECTED",
      label,
      "pass",
      `本地客户端已连接，${platformLabel}账号已登录有效。`,
    );
  }
  if (serverHeartbeat && browser !== true) {
    return check(
      "LOCAL_AGENT_CONNECTED",
      label,
      "fail",
      "客户端已启动并连接服务端，但当前浏览器尚未检测到本机客户端。请点击「检测连接」。",
      "检测连接",
    );
  }
  if (browser === true && snapshot.length === 0 && !inferServerHeartbeatConnected(input.platformAccounts)) {
    return check(
      "LOCAL_AGENT_CONNECTED",
      label,
      "fail",
      "客户端已连接，账号状态待同步。请点击「刷新账号状态」。",
      "刷新账号状态",
    );
  }
  if (browser === true && !input.accountValid) {
    return check(
      "LOCAL_AGENT_CONNECTED",
      label,
      "fail",
      "客户端已连接，账号状态待同步。请点击「刷新账号状态」。",
      "刷新账号状态",
    );
  }
  if (browser === false) {
    return check(
      "LOCAL_AGENT_CONNECTED",
      label,
      "fail",
      "未检测到本地客户端。请确认 GEO 本地发布客户端已打开，并点击「检测连接」。",
      "检测连接",
    );
  }
  return check(
    "LOCAL_AGENT_CONNECTED",
    label,
    "fail",
    "尚未检测本地客户端连接状态，请点击「检测连接」。",
    "检测连接",
  );
}

/** 统一发布前检查（Web 卡片 / 弹窗 / API create 共用） */
export function evaluatePublishPreflight(input: EvaluatePublishPreflightInput): PublishPreflightResult {
  const checks: PublishPreflightCheck[] = [];
  const blockingCodes: PublishPreflightCheckCode[] = [];
  const article = input.article ?? null;

  if (article && article.projectId != null && article.projectId !== input.projectId) {
    const c = check(
      "ARTICLE_BELONGS_TO_PROJECT",
      "文章归属当前项目",
      "fail",
      "当前内容不属于所选企业项目，无法加入发布队列。",
    );
    checks.push(c);
    blockingCodes.push(c.code);
    return {
      ready: false,
      checks,
      blockingCodes,
      selectedPlatform: null,
      canCreatePublishTask: false,
      readiness: null,
      platformLabel: "未知平台",
      resolvedPlatform: null,
    };
  }

  const browserConnected = resolveBrowserConnected(input.localAgentStatus);
  const readinessInput: PublishReadinessInput = {
    projectAccessible: input.projectAccessible ?? true,
    enterpriseProfileReady: input.enterpriseProfileReady ?? true,
    enterpriseProfile: input.enterpriseProfile ?? null,
    diagnosisReady: input.diagnosisReady ?? true,
    article,
    platformAccounts: input.platformAccounts,
    requestedPlatform: input.requestedPlatform ?? null,
    skipLocalAgentConnectionCheck: input.skipLocalAgentConnectionCheck ?? false,
    localAgentConnected: browserConnected,
    localAgentAccountSnapshot: input.localAgentStatus?.localAgentAccountSnapshot,
  };
  const readiness = evaluatePublishReadiness(readinessInput);
  const resolved = readiness.resolvedPlatform;
  const publishSlug =
    (input.requestedPlatform && isBindingPublishPlatform(input.requestedPlatform)
      ? input.requestedPlatform
      : null) ??
    (resolved?.publishQueueSlug && isBindingPublishPlatform(resolved.publishQueueSlug)
      ? resolved.publishQueueSlug
      : null);
  const platformLabel =
    (publishSlug ? PUBLISH_PLATFORM_LABELS[publishSlug] : null) ?? readiness.platformLabel ?? "未知平台";

  const workspaceOnlyBlocking = new Set([
    "PROJECT_INACCESSIBLE",
    "PROFILE_INCOMPLETE",
    "DIAGNOSIS_REQUIRED",
    "ARTICLE_MISSING",
  ]);
  if (
    !readiness.ready &&
    readiness.blockingCode &&
    workspaceOnlyBlocking.has(readiness.blockingCode)
  ) {
    const workspaceCheck = mapReadinessToWorkspaceCheck(readiness);
    if (workspaceCheck) {
      checks.push(workspaceCheck);
      blockingCodes.push(workspaceCheck.code);
    }
  }

  if (publishSlug && isBindingPublishPlatform(publishSlug)) {
    const platform = publishSlug as PrePublishChecklistPlatform;
    const accountValidity = isPlatformAccountValidForPublish({
      platform: publishSlug,
      account: input.selectedAccount,
      platformAccounts: input.platformAccounts,
      snapshot: input.localAgentStatus?.localAgentAccountSnapshot,
    });

    if (!input.skipLocalAgentConnectionCheck) {
      const agentCheck = buildLocalAgentCheck({
        skip: false,
        platform: publishSlug,
        platformLabel,
        status: input.localAgentStatus,
        platformAccounts: input.platformAccounts,
        accountValid: accountValidity.valid,
      });
      checks.push(agentCheck);
      if (agentCheck.status === "fail") blockingCodes.push(agentCheck.code);
    } else {
      checks.push(
        check("LOCAL_AGENT_CONNECTED", "本地客户端已连接", "pass", "服务端已确认本地发布环境"),
      );
    }

    if (!resolved?.recognized && !input.requestedPlatform) {
      const c = check("ARTICLE_PLATFORM_MATCH", "文章发布平台", "fail", readiness.message || "暂未识别本篇发布平台");
      checks.push(c);
      blockingCodes.push(c.code);
    } else if (resolved?.recognized || input.requestedPlatform) {
      checks.push(check("ARTICLE_PLATFORM_MATCH", "文章发布平台", "pass", `发布平台：${platformLabel}`));
      checks.push(check("PLATFORM_SUPPORTED", "平台支持自动发布", "pass", `${platformLabel} 支持本地客户端发布`));
    }

    const title = article?.title?.trim() ?? "";
    const titleMax = getPublishPlatformTitleMaxChars(platform);
    const titleLen = countPublishTitleChars(title);
    if (!title) {
      const c = check("TITLE_WITHIN_LIMIT", "标题未超过平台限制", "fail", "标题不能为空", "去编辑内容");
      checks.push(c);
      blockingCodes.push(c.code);
    } else if (titleLen > titleMax) {
      const c = check(
        "TITLE_WITHIN_LIMIT",
        "标题未超过平台限制",
        "fail",
        `${platformLabel}标题不超过 ${titleMax} 字（当前 ${titleLen} 字）`,
        "去编辑内容",
      );
      checks.push(c);
      blockingCodes.push(c.code);
    } else {
      checks.push(check("TITLE_WITHIN_LIMIT", "标题未超过平台限制", "pass", ""));
    }

    const bodyMin = getPublishPlatformMinBodyChars(platform);
    const bodyCount = countMarkdownBodyChars(article?.markdownContent ?? "");
    if (bodyCount < bodyMin) {
      const c = check(
        "BODY_MIN_LENGTH",
        "正文达到最低字数要求",
        "fail",
        `${platformLabel}正文不少于 ${bodyMin} 字（当前约 ${bodyCount} 字）`,
        "去编辑内容",
      );
      checks.push(c);
      blockingCodes.push(c.code);
    } else {
      checks.push(check("BODY_MIN_LENGTH", "正文达到最低字数要求", "pass", ""));
    }

    const hasCover = article ? articleHasPublishableCover(article) : false;
    if (!isCoverRequired(platform)) {
      checks.push(
        check(
          "COVER_READY",
          "封面图已配置",
          "pass",
          hasCover ? "封面图已配置" : "当前平台不强制封面",
        ),
      );
    } else if (hasCover) {
      checks.push(check("COVER_READY", "封面图已配置", "pass", "封面图已配置"));
    } else {
      const c = check(
        "COVER_READY",
        "封面图已配置",
        "fail",
        "请先在「编辑内容」中生成并保存封面图",
        "去编辑内容",
      );
      checks.push(c);
      blockingCodes.push(c.code);
    }

    const qualityArticle = (input.qualityResult ?? article) as ContentQualityGateArticle | null;
    if (isGeoQualityScoreStale(qualityArticle)) {
      const c = check("QUALITY_PASSED", "内容已通过质检", "fail", "内容已修改，请重新质检后再发布", "重新质检");
      checks.push(c);
      blockingCodes.push(c.code);
    } else {
      const gate = getUnifiedQualityGateStatus(qualityArticle);
      if (gate.passed) {
        checks.push(check("QUALITY_PASSED", "内容已通过质检", "pass", ""));
      } else {
        const c = check(
          "QUALITY_PASSED",
          "内容已通过质检",
          "fail",
          gate.message || "当前内容未通过发布前质检",
          "重新质检",
        );
        checks.push(c);
        blockingCodes.push(c.code);
      }
    }

    if (!accountValidity.valid) {
      const account = input.selectedAccount;
      let message = `请选择「${platformLabel}」已绑定且登录有效的发布账号`;
      let action = "去账号环境";
      if (account?.sessionStatus === "expired") {
        message = publishBlockedSessionExpiredMessage(publishSlug);
      } else if (readiness.blockingCode === "ACCOUNT_STATUS_NOT_SYNCED") {
        message = readiness.message;
        action = "刷新账号状态";
      } else if (readiness.blockingCode === "PLATFORM_ACCOUNT_UNBOUND") {
        message = readiness.message;
        action = "去账号环境";
      }
      const c = check("PLATFORM_ACCOUNT_VALID", "发布账号有效", "fail", message, action);
      if (!checks.some(x => x.code === "PLATFORM_ACCOUNT_VALID")) {
        checks.push(c);
        blockingCodes.push(c.code);
      }
    } else {
      const status: PublishPreflightCheckStatus = accountValidity.nicknameWarning ? "warning" : "pass";
      checks.push(
        check(
          "PLATFORM_ACCOUNT_VALID",
          "发布账号有效",
          status,
          status === "warning" ? "账号已登录有效（昵称待识别，不阻断发布）" : `${platformLabel}账号已登录有效`,
        ),
      );
    }
  } else if (!readiness.ready) {
    // readiness 已记录 workspace / platform 阻断
  }

  const uniqueBlocking = Array.from(new Set(blockingCodes));
  const ready = uniqueBlocking.length === 0 && Boolean(publishSlug);

  return {
    ready,
    checks,
    blockingCodes: uniqueBlocking,
    selectedPlatform: publishSlug,
    selectedAccountId: input.selectedAccountId ?? undefined,
    canCreatePublishTask: ready,
    readiness,
    platformLabel,
    resolvedPlatform: resolved,
  };
}

export function formatPublishPreflightBlockMessage(result: PublishPreflightResult): string {
  const failed = result.checks.filter(c => c.status === "fail");
  if (failed.length === 0) return "";
  const primary = failed[0]!;
  return `[${primary.code}] ${primary.message}`;
}

export function publishPreflightBlockingCodeFromError(message: string): PublishPreflightCheckCode | null {
  const match = /^\[([A-Z_]+)\]/.exec(message.trim());
  if (!match?.[1]) return null;
  return match[1] as PublishPreflightCheckCode;
}

/** 服务端 create：与 evaluatePrePublishChecklist 等价但更严格地复用 preflight */
export function evaluatePublishPreflightForCreate(
  input: Omit<EvaluatePublishPreflightInput, "skipLocalAgentConnectionCheck"> & {
    boundAccount: PublishReadyAccountRow & { id: number };
    platform: BindingPublishPlatform;
  },
): PublishPreflightResult {
  const checklist = evaluatePrePublishChecklist({
    title: input.article?.title ?? "",
    markdownContent: input.article?.markdownContent ?? "",
    coverBase64: input.article?.coverBase64,
    coverImageUrl: input.article?.coverImageUrl,
    coverUrl: input.article?.coverUrl,
    coverAssetId: input.article?.coverAssetId,
    coverImage: input.article?.coverImage,
    generationBasis: input.article?.generationBasis,
    retainedCoverUrl: input.article?.retainedCoverUrl,
    manualCoverUrl: input.article?.manualCoverUrl,
    platform: input.platform,
    article: input.article ?? {},
    account: { ...input.boundAccount, platform: input.platform },
    localAgentAccountValid: isPlatformAccountValidForPublish({
      platform: input.platform,
      account: input.boundAccount,
      platformAccounts: input.platformAccounts,
      snapshot: input.localAgentStatus?.localAgentAccountSnapshot,
    }).valid,
  });

  const preflight = evaluatePublishPreflight({
    ...input,
    requestedPlatform: input.platform,
    selectedAccount: input.boundAccount,
    selectedAccountId: input.boundAccount.id,
    skipLocalAgentConnectionCheck: true,
    localAgentStatus: {
      serverHeartbeatConnected: inferServerHeartbeatConnected(input.platformAccounts),
      browserLocalAgentConnected: true,
      localAgentAccountSnapshot: input.localAgentStatus?.localAgentAccountSnapshot,
    },
  });

  if (!checklist.allPassed) {
    for (const item of checklist.items.filter(i => !i.passed)) {
      const codeMap: Record<string, PublishPreflightCheckCode> = {
        title_within_limit: "TITLE_WITHIN_LIMIT",
        body_min_length: "BODY_MIN_LENGTH",
        has_cover: "COVER_READY",
        account_valid: "PLATFORM_ACCOUNT_VALID",
        quality_passed: "QUALITY_PASSED",
      };
      const code = codeMap[item.id] ?? "WORKSPACE_READY";
      if (!preflight.blockingCodes.includes(code)) {
        preflight.blockingCodes.push(code);
        preflight.checks.push({
          code,
          label: item.label,
          status: "fail",
          message: item.reason,
        });
      }
    }
    preflight.ready = false;
    preflight.canCreatePublishTask = false;
  }

  return preflight;
}
