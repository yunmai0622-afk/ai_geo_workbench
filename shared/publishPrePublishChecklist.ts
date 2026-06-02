/** GEO-V1.1-Pre-Publish-Checklist：加入发布队列前的 5 项自动检查 */

import type { BindingPublishPlatform } from "./platformAccountVerify";
import { PUBLISH_PLATFORM_LABELS, publishBlockedSessionExpiredMessage } from "./platformAccountVerify";
import { countMarkdownBodyChars, ZHIHU_DRAFT_MIN_BODY_CHARS } from "./platformDraftContentQuality";
import { getContentQualityGateStatus, type ContentQualityGateArticle } from "./contentQualityGate";
import { isGeoQualityScoreStale } from "./geoQualityStale";
import { isPublishReadyPlatformAccount, type PublishReadyAccountRow } from "./publishReadiness";
import { XIAOHONGSHU_NOTE_TITLE_MAX_LEN } from "./xiaohongshuMaterial";

export type PrePublishChecklistItemId =
  | "title_within_limit"
  | "body_min_length"
  | "has_cover"
  | "account_valid"
  | "quality_passed";

export type PrePublishChecklistItem = {
  id: PrePublishChecklistItemId;
  label: string;
  passed: boolean;
  reason: string;
};

export type PrePublishChecklistResult = {
  allPassed: boolean;
  items: PrePublishChecklistItem[];
};

export type PrePublishChecklistPlatform = BindingPublishPlatform | "wechat" | "xiaohongshu";
export const PRE_PUBLISH_COVER_OPTIONAL_PLATFORMS: readonly PrePublishChecklistPlatform[] = ["toutiao"] as const;

/** 各平台标题字数上限（按 Unicode 码点计） */
export const PUBLISH_PLATFORM_TITLE_MAX_CHARS: Record<PrePublishChecklistPlatform, number> = {
  zhihu: 100,
  toutiao: 30,
  sohu: 36,
  baijiahao: 30,
  netease: 30,
  xiaohongshu: XIAOHONGSHU_NOTE_TITLE_MAX_LEN,
  wechat: 64,
};

/** 各平台正文最低字数（Markdown 去空白计） */
export const PUBLISH_PLATFORM_MIN_BODY_CHARS: Record<PrePublishChecklistPlatform, number> = {
  zhihu: ZHIHU_DRAFT_MIN_BODY_CHARS,
  toutiao: 400,
  sohu: 400,
  baijiahao: 400,
  netease: 400,
  xiaohongshu: 200,
  wechat: 500,
};

export const PRE_PUBLISH_CHECKLIST_ITEM_LABELS: Record<PrePublishChecklistItemId, string> = {
  title_within_limit: "标题未超过平台限制",
  body_min_length: "正文达到最低字数要求",
  has_cover: "已配置封面图",
  account_valid: "发布账号有效",
  quality_passed: "内容已通过质检",
};

export function countPublishTitleChars(title: string): number {
  return Array.from(title.trim()).length;
}

export function getPublishPlatformTitleMaxChars(platform: PrePublishChecklistPlatform): number {
  return PUBLISH_PLATFORM_TITLE_MAX_CHARS[platform];
}

export function getPublishPlatformMinBodyChars(platform: PrePublishChecklistPlatform): number {
  return PUBLISH_PLATFORM_MIN_BODY_CHARS[platform];
}

export function articleHasPublishableCover(article: {
  coverBase64?: string | null;
  coverImageUrl?: string | null;
}): boolean {
  return Boolean(article.coverBase64?.trim() || article.coverImageUrl?.trim());
}

export type PrePublishChecklistInput = {
  title: string;
  markdownContent: string;
  coverBase64?: string | null;
  coverImageUrl?: string | null;
  platform: PrePublishChecklistPlatform;
  platformLabel?: string;
  article: ContentQualityGateArticle;
  account?: PublishReadyAccountRow | null;
  /** 本地客户端已连接且该平台账号 loginStatus=valid */
  localAgentAccountValid?: boolean;
};

function item(
  id: PrePublishChecklistItemId,
  passed: boolean,
  reason: string,
): PrePublishChecklistItem {
  return {
    id,
    label: PRE_PUBLISH_CHECKLIST_ITEM_LABELS[id],
    passed,
    reason: passed ? "" : reason,
  };
}

function evaluateTitleCheck(input: PrePublishChecklistInput, platformLabel: string): PrePublishChecklistItem {
  const title = input.title.trim();
  if (!title) {
    return item("title_within_limit", false, "标题不能为空");
  }
  const max = getPublishPlatformTitleMaxChars(input.platform);
  const len = countPublishTitleChars(title);
  if (len > max) {
    return item(
      "title_within_limit",
      false,
      `${platformLabel}标题不超过 ${max} 字（当前 ${len} 字）`,
    );
  }
  return item("title_within_limit", true, "");
}

function evaluateBodyCheck(input: PrePublishChecklistInput, platformLabel: string): PrePublishChecklistItem {
  const min = getPublishPlatformMinBodyChars(input.platform);
  const bodyCharCount = countMarkdownBodyChars(input.markdownContent ?? "");
  if (bodyCharCount < min) {
    return item(
      "body_min_length",
      false,
      `${platformLabel}正文不少于 ${min} 字（当前约 ${bodyCharCount} 字）`,
    );
  }
  return item("body_min_length", true, "");
}

function evaluateCoverCheck(input: PrePublishChecklistInput): PrePublishChecklistItem {
  if (PRE_PUBLISH_COVER_OPTIONAL_PLATFORMS.includes(input.platform)) {
    return item("has_cover", true, "");
  }
  if (articleHasPublishableCover(input)) {
    return item("has_cover", true, "");
  }
  return item(
    "has_cover",
    false,
    "请先在「编辑内容」中生成并保存封面图（或保留有效封面链接）",
  );
}

function evaluateAccountCheck(input: PrePublishChecklistInput, platformLabel: string): PrePublishChecklistItem {
  const account = input.account;
  if (account && isPublishReadyPlatformAccount(account)) {
    return item("account_valid", true, "");
  }
  if (account?.sessionStatus === "expired") {
    return item("account_valid", false, publishBlockedSessionExpiredMessage(input.platform as BindingPublishPlatform));
  }
  if (input.localAgentAccountValid) {
    return item("account_valid", true, "");
  }
  if (!account) {
    return item(
      "account_valid",
      false,
      `请选择「${platformLabel}」已绑定且登录有效的发布账号`,
    );
  }
  if (!account.localProfileId?.trim() || !account.localAgentId?.trim()) {
    return item(
      "account_valid",
      false,
      `「${platformLabel}」账号尚未绑定本地发布环境，请在企业档案完成绑定`,
    );
  }
  if (account.sessionStatus !== "active") {
    return item(
      "account_valid",
      false,
      `「${platformLabel}」账号登录状态无效，请在本地客户端重新登录`,
    );
  }
  return item("account_valid", false, `「${platformLabel}」发布账号尚未就绪`);
}

function evaluateQualityCheck(input: PrePublishChecklistInput): PrePublishChecklistItem {
  if (isGeoQualityScoreStale(input.article)) {
    return item(
      "quality_passed",
      false,
      "内容已修改，请重新质检后再发布",
    );
  }
  const gate = getContentQualityGateStatus(input.article);
  if (gate.passed) {
    return item("quality_passed", true, "");
  }
  return item("quality_passed", false, gate.message || "当前内容未通过发布前质检");
}

/** 加入发布队列前 5 项检查（Web / API 共用） */
export function evaluatePrePublishChecklist(input: PrePublishChecklistInput): PrePublishChecklistResult {
  const platformLabel =
    input.platformLabel?.trim() ||
    PUBLISH_PLATFORM_LABELS[input.platform as BindingPublishPlatform] ||
    input.platform;

  const items: PrePublishChecklistItem[] = [
    evaluateTitleCheck(input, platformLabel),
    evaluateBodyCheck(input, platformLabel),
    evaluateCoverCheck(input),
    evaluateAccountCheck(input, platformLabel),
    evaluateQualityCheck(input),
  ];

  return {
    allPassed: items.every(i => i.passed),
    items,
  };
}

export function formatPrePublishChecklistBlockMessage(result: PrePublishChecklistResult): string {
  const failed = result.items.filter(i => !i.passed);
  if (failed.length === 0) return "";
  return `发布前检查未通过：${failed.map(i => i.reason).join("；")}`;
}
