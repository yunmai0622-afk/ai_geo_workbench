import {
  customerMessageForAgentPublishFailure,
  publishTaskStatusCustomerLabel,
} from "@shared/publishTaskErrors";
import { isBindingPublishPlatform, PUBLISH_PLATFORM_LABELS } from "@shared/platformAccountVerify";
import { isPublishRetryExhausted, MAX_PUBLISH_TASK_RETRIES } from "@shared/publishTaskRetry";

export type PublishColumnId = "pending" | "active" | "done";

export type PublishTaskCardModel = {
  key: string;
  taskId?: number;
  recordId?: number;
  articleId?: number | null;
  title: string;
  platformLabel: string;
  accountLabel: string;
  contentGoal: string | null;
  geoGap: string | null;
  statusRaw: string;
  statusLabel: string;
  statusBadgeClass: string;
  errorMessage: string | null;
  column: PublishColumnId;
  isAbnormal: boolean;
  previewUrl: string | null;
  draftUrl: string | null;
  publishedUrl: string | null;
  timeLabel: string | null;
  linkDraft?: string;
  /** Agent 发布完成且已写入收录监测时展示 */
  autoInclusionMonitoring?: boolean;
  retryCount?: number;
  canRetry?: boolean;
  retryExhausted?: boolean;
};

export const AUTO_INCLUSION_MONITORING_HINT = "已自动进入收录监测";

const EXTRA_PLATFORM_LABELS: Record<string, string> = {
  xiaohongshu: "小红书",
  wechat: "微信公众号",
  weixin: "微信公众号",
};

export function publishPlatformCustomerLabel(platform: string): string {
  const trimmed = platform.trim();
  if (!trimmed) return "未标注平台";
  if (isBindingPublishPlatform(trimmed)) return PUBLISH_PLATFORM_LABELS[trimmed];
  return EXTRA_PLATFORM_LABELS[trimmed.toLowerCase()] ?? trimmed;
}

export function publishTaskStatusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
    case "pending_agent":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "copied":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "manual_required":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "draft_saved":
      return "bg-sky-50 text-sky-800 border-sky-200";
    case "completed":
    case "published":
    case "link_backfilled":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "failed":
    case "publish_failed":
      return "bg-red-50 text-red-800 border-red-200";
    case "agent_processing":
    case "processing":
      return "bg-indigo-50 text-indigo-800 border-indigo-200";
    case "session_expired":
      return "bg-orange-50 text-orange-800 border-orange-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export function classifyPublishTaskColumn(status: string): PublishColumnId {
  if (status === "pending" || status === "pending_agent" || status === "copied") {
    return "pending";
  }
  if (status === "manual_required" || status === "draft_saved") {
    return "active";
  }
  if (status === "completed" || status === "failed") {
    return "done";
  }
  if (
    status === "agent_processing" ||
    status === "processing" ||
    status === "session_expired"
  ) {
    return "active";
  }
  return "done";
}

function formatTaskTime(value?: Date | string | number | null): string | null {
  if (value == null) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" });
}

function resolveTaskTimeLabel(task: {
  agentFinishedAt?: Date | string | number | null;
  agentPickedAt?: Date | string | number | null;
  createdAt?: Date | string | number | null;
}): string | null {
  return (
    formatTaskTime(task.agentFinishedAt) ??
    formatTaskTime(task.agentPickedAt) ??
    formatTaskTime(task.createdAt)
  );
}

export function mapAgentTaskToCard(
  task: {
    id: number;
    articleId: number;
    articleTitle: string | null;
    platform: string;
    status: string;
    expectedAccountName: string | null;
    agentErrorType?: string | null;
    agentErrorMessage?: string | null;
    draftUrl?: string | null;
    resultUrl?: string | null;
    agentFinishedAt?: Date | string | number | null;
    agentPickedAt?: Date | string | number | null;
    createdAt?: Date | string | number | null;
    retryCount?: number | null;
    canRetry?: boolean;
    retryExhausted?: boolean;
  },
  contentGoal?: string | null,
  options?: { autoInclusionMonitoring?: boolean },
): PublishTaskCardModel {
  const column = classifyPublishTaskColumn(task.status);
  const retryCount = task.retryCount ?? 0;
  const retryExhausted = task.retryExhausted ?? isPublishRetryExhausted({ status: task.status, retryCount });
  const canRetry = task.canRetry ?? (task.status === "failed" && retryCount < MAX_PUBLISH_TASK_RETRIES);
  const isAbnormal =
    task.status === "failed" || task.status === "session_expired" || retryExhausted;
  const draftUrl = task.draftUrl?.trim() || null;
  const publishedUrl = task.resultUrl?.trim() || null;
  const errorMessage =
    task.status === "failed"
      ? customerMessageForAgentPublishFailure(task.agentErrorMessage, task.agentErrorType)
      : null;

  return {
    key: `task-${task.id}`,
    taskId: task.id,
    articleId: task.articleId,
    title: task.articleTitle?.trim() || "未命名内容",
    platformLabel: publishPlatformCustomerLabel(task.platform),
    accountLabel: task.expectedAccountName?.trim() || "未绑定账号",
    contentGoal: contentGoal ?? null,
    geoGap: null,
    statusRaw: task.status,
    statusLabel: publishTaskStatusCustomerLabel({
      status: task.status,
      agentErrorMessage: task.agentErrorMessage,
    }),
    statusBadgeClass: publishTaskStatusBadgeClass(task.status),
    errorMessage,
    column,
    isAbnormal,
    previewUrl: draftUrl ?? publishedUrl ?? null,
    draftUrl,
    publishedUrl: task.status === "completed" ? publishedUrl : null,
    timeLabel: resolveTaskTimeLabel(task),
    autoInclusionMonitoring:
      Boolean(options?.autoInclusionMonitoring) &&
      task.status === "completed" &&
      Boolean(publishedUrl),
    retryCount,
    canRetry,
    retryExhausted,
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
    publishedAt?: Date | string | number | null;
  },
  articleTitle?: string | null,
): PublishTaskCardModel | null {
  const link = (record.publishUrl ?? record.publicUrl ?? "").trim();
  const status = record.publishStatus ?? "";
  const pendingLink =
    status === "pending_human_publish" ||
    status === "manual_publish_needed" ||
    (!link && status !== "publish_failed");
  if (!pendingLink && status !== "link_backfilled" && status !== "published") {
    return null;
  }

  const manualStatus = link ? "link_backfilled" : "pending_human_publish";

  return {
    key: `record-${record.id}`,
    recordId: record.id,
    articleId: record.articleId,
    title: articleTitle?.trim() || record.publishTitle?.trim() || "发布记录",
    platformLabel: publishPlatformCustomerLabel(record.publishChannel?.trim() || "未标注平台"),
    accountLabel: "人工登记",
    contentGoal: null,
    geoGap: null,
    statusRaw: manualStatus,
    statusLabel: link ? "已填写公开链接" : "待填写公开链接",
    statusBadgeClass: publishTaskStatusBadgeClass(manualStatus),
    errorMessage: status === "publish_failed" ? "发布失败，请重试或联系支持" : null,
    column: "done",
    isAbnormal: status === "publish_failed",
    previewUrl: link || null,
    draftUrl: null,
    publishedUrl: link || null,
    timeLabel: formatTaskTime(record.publishedAt),
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
