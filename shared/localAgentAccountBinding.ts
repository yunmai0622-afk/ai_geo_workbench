/** Local Agent 账号环境 — Web 引导文案与平台边界（与 local-agent 能力对齐） */

import {
  localAgentConnectionCopy,
  localAgentConnectionRiskHint,
  mapBooleanOnlineToConnectionStatus,
  type LocalAgentConnectionStatus,
} from "./localAgentConnectionStatus";
import { BINDING_PUBLISH_PLATFORMS, PUBLISH_PLATFORM_LABELS } from "./platformAccountVerify";

/** 可在客户端「账号环境」中创建独立浏览器配置的平台 */
export const LOCAL_AGENT_ACCOUNT_ENV_CREATABLE = BINDING_PUBLISH_PLATFORMS;

export type LocalAgentAccountEnvCreatablePlatform = (typeof LOCAL_AGENT_ACCOUNT_ENV_CREATABLE)[number];

/** 即将支持自动创建/发布的平台（需在 UI 明确提示，禁止无反应） */
export const LOCAL_AGENT_ACCOUNT_ENV_PENDING = ["xiaohongshu", "wechat"] as const;

export const LOCAL_AGENT_ACCOUNT_ENV_PENDING_LABELS: Record<
  (typeof LOCAL_AGENT_ACCOUNT_ENV_PENDING)[number],
  string
> = {
  xiaohongshu: "小红书",
  wechat: "公众号",
};

export const LOCAL_AGENT_ACCOUNT_BINDING_TITLE = "尚未配置本地发布账号";

export const LOCAL_AGENT_ACCOUNT_BINDING_BODY =
  "平台账号登录环境只保存在你的本地发布客户端，不会上传密码或 Cookie。请打开本地客户端，在「账号环境」中创建并登录对应平台账号。";

export const LOCAL_AGENT_NOT_CONNECTED_HINT = localAgentConnectionCopy("DISCONNECTED").description;

export const LOCAL_AGENT_CONNECTED_NO_ACCOUNT_HINT =
  "客户端已连接，但尚未创建任何平台账号环境。请在客户端「账号环境」中创建并登录。";

export function formatCreatablePlatformList(): string {
  return LOCAL_AGENT_ACCOUNT_ENV_CREATABLE.map(id => PUBLISH_PLATFORM_LABELS[id]).join("、");
}

export function formatPendingPlatformList(): string {
  return LOCAL_AGENT_ACCOUNT_ENV_PENDING.map(id => LOCAL_AGENT_ACCOUNT_ENV_PENDING_LABELS[id]).join("、");
}

export function isLocalAgentAccountEnvCreatable(platform: string): platform is LocalAgentAccountEnvCreatablePlatform {
  return (LOCAL_AGENT_ACCOUNT_ENV_CREATABLE as readonly string[]).includes(platform);
}

export function workspacePublishAccountRiskHint(
  localAgentOnline?: boolean | null,
  localAgentConnectionStatus?: LocalAgentConnectionStatus,
): string {
  const status =
    localAgentConnectionStatus ?? mapBooleanOnlineToConnectionStatus(localAgentOnline);
  if (status !== "CONNECTED") {
    const hint = localAgentConnectionRiskHint(status, { boundPublishAccountCount: 0 });
    if (hint) return hint;
  }
  return "尚未在本地发布客户端配置可发布账号。请在客户端「账号环境」中创建并登录，再返回本页点击刷新账号状态。";
}
