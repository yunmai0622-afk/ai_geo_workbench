import { publishTaskStatusCustomerLabel } from "@shared/publishTaskErrors";

export type PublishColumnId = "pending" | "active" | "done";

export type PublishTaskCardModel = {
  key: string;
  taskId?: number;
  recordId?: number;
  articleId?: number | null;
  title: string;
  platform: string;
  accountLabel: string;
  contentGoal: string | null;
  geoGap: string | null;
  statusLabel: string;
  column: PublishColumnId;
  isAbnormal: boolean;
  previewUrl: string | null;
  linkDraft?: string;
};

export function classifyPublishTaskColumn(status: string): PublishColumnId {
  if (status === "pending_agent" || status === "pending") return "pending";
  if (
    status === "agent_processing" ||
    status === "processing" ||
    status === "manual_required" ||
    status === "draft_saved"
  ) {
    return "active";
  }
  if (status === "failed" || status === "session_expired") return "active";
  return "done";
}

export function mapAgentTaskToCard(
  task: {
    id: number;
    articleId: number;
    articleTitle: string | null;
    platform: string;
    status: string;
    expectedAccountName: string | null;
    agentErrorMessage?: string | null;
    draftUrl?: string | null;
    resultUrl?: string | null;
  },
  contentGoal?: string | null,
): PublishTaskCardModel {
  const column = classifyPublishTaskColumn(task.status);
  const isAbnormal = task.status === "failed" || task.status === "session_expired";
  return {
    key: `task-${task.id}`,
    taskId: task.id,
    articleId: task.articleId,
    title: task.articleTitle?.trim() || "未命名内容",
    platform: task.platform,
    accountLabel: task.expectedAccountName?.trim() || "未绑定账号",
    contentGoal: contentGoal ?? null,
    geoGap: null,
    statusLabel: publishTaskStatusCustomerLabel({
      status: task.status,
      agentErrorMessage: task.agentErrorMessage,
    }),
    column: isAbnormal ? "active" : column,
    isAbnormal,
    previewUrl: task.draftUrl ?? task.resultUrl ?? null,
  };
}

export function mapManualRecordToCard(
  record: {
    id: number;
    articleId?: number | null;
    publishTitle?: string | null;
    publishChannel?: string | null;
    publishStatus?: string | null;
    publishUrl?: string | null;
    publicUrl?: string | null;
  },
  articleTitle?: string | null,
): PublishTaskCardModel | null {
  const link = (record.publishUrl ?? record.publicUrl ?? "").trim();
  const pendingLink =
    record.publishStatus === "pending_human_publish" ||
    record.publishStatus === "manual_publish_needed" ||
    (!link && record.publishStatus !== "publish_failed");
  if (!pendingLink && record.publishStatus !== "link_backfilled" && record.publishStatus !== "published") {
    return null;
  }
  return {
    key: `record-${record.id}`,
    recordId: record.id,
    articleId: record.articleId,
    title: articleTitle?.trim() || record.publishTitle?.trim() || "发布记录",
    platform: record.publishChannel?.trim() || "未标注平台",
    accountLabel: "人工登记",
    contentGoal: null,
    geoGap: null,
    statusLabel: link ? "已填写公开链接" : "待填写公开链接",
    column: "done",
    isAbnormal: record.publishStatus === "publish_failed",
    previewUrl: link || null,
    linkDraft: link,
  };
}

export const LOCAL_AGENT_PUBLISH_STEPS = [
  "打开 Local Agent",
  "确认平台账号已登录",
  "选择待发布内容",
  "本地浏览器打开发布页面",
  "人工确认发布",
  "回填公开链接",
  "进入收录监测",
] as const;
