import {
  PUBLISH_QUEUE_DUPLICATE_MESSAGE,
  PUBLISH_QUEUE_DUPLICATE_RETRY_MESSAGE,
} from "./publishQueueDedup";
import {
  publishBlockedNoAccountMessage,
  publishBlockedNoLocalProfileMessage,
  publishBlockedSessionExpiredMessage,
  publishMustSelectAccountMessage,
  platformAccountInvalidMessage,
} from "./platformAccountVerify";
import { publishPreflightBlockingCodeFromError } from "./publishPreflight";
import { GENERIC_SERVER_ERROR_MESSAGE } from "./userFacingErrors";

export const REVIEW_ENQUEUE_SUCCESS_MESSAGE = "已审核并加入发布队列";

export const REVIEW_ENQUEUE_CUSTOMER_MESSAGES = {
  accountNotSynced: "发布账号未同步：请刷新账号状态",
  noPlatformAccount: "当前项目未绑定该平台账号：请先绑定发布账号",
  platformMissing: "内容平台缺失：请重新生成该平台内容",
  qualityNotPassed: "内容尚未通过质检：请重新质检",
  coverMissing: "封面缺失：请配置封面",
  duplicateTask: "已存在发布任务：请到平台适配发布页查看",
  mustSelectAccount: "当前平台绑定了多个账号：请选择本次发布使用的账号",
  serverError: "服务端异常：请稍后重试或联系管理员",
} as const;

/** 将服务端校验/创建错误映射为客户可读原因 */
export function mapReviewEnqueueCustomerMessage(raw: string | undefined | null): string {
  const message = (raw ?? "").trim();
  if (!message) return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.serverError;

  if (
    message === PUBLISH_QUEUE_DUPLICATE_MESSAGE ||
    message === PUBLISH_QUEUE_DUPLICATE_RETRY_MESSAGE ||
    message.includes("已在发布队列")
  ) {
    return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.duplicateTask;
  }

  const preflightCode = publishPreflightBlockingCodeFromError(message);
  if (preflightCode) {
    switch (preflightCode) {
      case "COVER_READY":
        return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.coverMissing;
      case "QUALITY_PASSED":
        return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.qualityNotPassed;
      case "ARTICLE_PLATFORM_MATCH":
      case "PLATFORM_SUPPORTED":
        return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.platformMissing;
      case "PLATFORM_ACCOUNT_VALID":
        return message.includes("同步") || message.includes("昵称")
          ? REVIEW_ENQUEUE_CUSTOMER_MESSAGES.accountNotSynced
          : REVIEW_ENQUEUE_CUSTOMER_MESSAGES.noPlatformAccount;
      default:
        break;
    }
  }

  if (
    message.includes(publishBlockedNoAccountMessage("zhihu").slice(0, 6)) ||
    message.includes("尚未绑定") && message.includes("账号")
  ) {
    return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.noPlatformAccount;
  }

  for (const platform of ["zhihu", "sohu", "toutiao", "baijiahao", "netease"] as const) {
    if (message === publishBlockedNoAccountMessage(platform)) {
      return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.noPlatformAccount;
    }
    if (message === publishMustSelectAccountMessage(platform)) {
      return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.mustSelectAccount;
    }
    if (message === publishBlockedNoLocalProfileMessage(platform)) {
      return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.noPlatformAccount;
    }
    if (message === publishBlockedSessionExpiredMessage(platform)) {
      return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.accountNotSynced;
    }
    if (message === platformAccountInvalidMessage(platform)) {
      return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.accountNotSynced;
    }
  }

  if (message.includes("封面") || message.includes("COVER_READY")) {
    return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.coverMissing;
  }
  if (message.includes("质检") || message.includes("QUALITY")) {
    return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.qualityNotPassed;
  }
  if (message.includes("平台") && (message.includes("缺失") || message.includes("不可用"))) {
    return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.platformMissing;
  }
  if (message.includes("同步") || message.includes("登录态")) {
    return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.accountNotSynced;
  }
  if (message === "数据库不可用" || message === GENERIC_SERVER_ERROR_MESSAGE) {
    return REVIEW_ENQUEUE_CUSTOMER_MESSAGES.serverError;
  }

  return message;
}
