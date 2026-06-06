import type { LocalAgentConnectionStatus } from "./localAgentConnectionStatus";

export type PublishAccountBindCtaState =
  | "not_connected"
  | "not_synced"
  | "not_bound"
  | "bound";

export type PublishAccountBindCtaInput = {
  localAgentConnectionStatus: LocalAgentConnectionStatus;
  localAgentConnectedOnline: boolean;
  boundPublishAccountCount: number;
  localAccountSnapshotEmpty?: boolean;
};

export function resolvePublishAccountBindCtaState(
  input: PublishAccountBindCtaInput,
): PublishAccountBindCtaState {
  if (input.boundPublishAccountCount > 0) {
    return "bound";
  }
  if (!input.localAgentConnectedOnline) {
    return "not_connected";
  }
  if (input.localAgentConnectionStatus === "CONNECTED_ACCOUNT_NOT_SYNCED") {
    return "not_synced";
  }
  return "not_bound";
}

export function publishAccountBindCtaLabel(state: PublishAccountBindCtaState): string {
  switch (state) {
    case "not_connected":
      return "检测客户端连接";
    case "not_synced":
      return "刷新账号状态";
    case "not_bound":
      return "绑定发布账号";
    case "bound":
      return "查看可发布账号";
  }
}

export const PUBLISH_ACCOUNT_BIND_NOT_CONNECTED_DIALOG = {
  title: "绑定发布账号前，请先连接本地发布助手",
  body: "发布账号保存在本机客户端中。请先打开 GEO 本地发布助手，确认顶部显示「GEO Web 已连接」。",
} as const;

export const PUBLISH_ACCOUNT_BIND_NOT_BOUND_DIALOG = {
  title: "请在本地发布助手中绑定发布账号",
  body: "请打开本地发布助手 → 账号环境 → 选择平台 → 添加账号并完成登录。",
} as const;
