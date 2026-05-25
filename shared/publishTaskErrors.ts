/** 发布错误类型（含历史浏览器助手任务兼容；当前主链路为 Local Agent） */

export const PUBLISH_ERROR_TYPES = [
  "login_required",
  "captcha_or_verify",
  "account_mismatch",
  "account_unknown",
  "publish_page_not_found",
  "editor_not_found",
  "editor_not_ready",
  "content_injection_failed",
  "cover_upload_failed",
  "submit_button_not_found",
  "submit_failed",
  "category_required",
  "timeout",
  "unknown",
] as const;

export type PublishErrorType = (typeof PUBLISH_ERROR_TYPES)[number];

export type PublishErrorPayload = {
  errorType: PublishErrorType;
  step: string;
  customerMessage: string;
  detail?: string;
  selector?: string;
};

const CUSTOMER_MESSAGES: Record<PublishErrorType, string> = {
  login_required: "当前平台未登录或登录已失效，请登录绑定账号后重试。",
  captcha_or_verify: "遇到验证码或安全验证，请人工完成验证后重试。",
  account_mismatch: "当前登录账号与项目绑定账号不一致，已停止发布。",
  account_unknown: "无法识别当前登录账号，已停止发布。",
  publish_page_not_found: "未能打开发布页面，请确认平台可访问。",
  editor_not_found: "未找到标题或正文编辑器，请确认已进入图文发布页。",
  editor_not_ready: "编辑器尚未就绪，请稍后重试。",
  content_injection_failed: "标题或正文填写失败，请检查内容格式后重试。",
  cover_upload_failed: "封面上传失败；若平台强制封面，请重新生成封面后重试。",
  submit_button_not_found: "未找到发布或保存草稿按钮。",
  submit_failed: "已点击发布/保存，但未检测到成功结果。",
  category_required: "平台要求选择分类或栏目，请人工补全后重试。",
  timeout: "操作超时，请检查网络与页面加载后重试。",
  unknown: "发布失败，请查看调试日志或联系交付同学。",
};

export function customerMessageForPublishError(errorType: string, step?: string): string {
  const base =
    CUSTOMER_MESSAGES[errorType as PublishErrorType] ?? CUSTOMER_MESSAGES.unknown;
  if (!step) return base;
  if (errorType === "timeout" || errorType === "editor_not_found" || errorType === "editor_not_ready") {
    return `${base}（步骤：${step}）`;
  }
  return base;
}

export function buildPublishErrorPayload(input: {
  errorType: PublishErrorType;
  step: string;
  detail?: string;
  selector?: string;
}): PublishErrorPayload & { errorMessage: string } {
  const customerMessage = customerMessageForPublishError(input.errorType, input.step);
  const payload: PublishErrorPayload = {
    errorType: input.errorType,
    step: input.step,
    customerMessage,
    detail: input.detail,
    selector: input.selector,
  };
  return {
    ...payload,
    errorMessage: serializePublishErrorPayload(payload),
  };
}

export function serializePublishErrorPayload(payload: PublishErrorPayload): string {
  return JSON.stringify(payload);
}

export function parsePublishTaskErrorMessage(
  raw: string | null | undefined,
): PublishErrorPayload | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as PublishErrorPayload;
    if (parsed.errorType && parsed.customerMessage) return parsed;
  } catch {
    /* legacy plain text */
  }
  if (raw.includes("等待编辑器超时")) {
    return {
      errorType: "editor_not_found",
      step: "wait_editor_ready",
      customerMessage: customerMessageForPublishError("editor_not_found", "wait_editor_ready"),
      detail: raw,
    };
  }
  return {
    errorType: "unknown",
    step: "unknown",
    customerMessage: raw.length > 120 ? `${raw.slice(0, 120)}…` : raw,
    detail: raw,
  };
}

export function publishTaskStatusCustomerLabel(input: {
  status: string;
  accountVerificationStatus?: string | null;
  errorMessage?: string | null;
  agentErrorMessage?: string | null;
}): string {
  if (input.status === "draft_saved") return "已保存草稿";
  if (input.status === "completed") return "已发布";
  if (input.status === "processing") return "发布中";
  if (input.status === "pending_agent") return "等待本地客户端处理";
  if (input.status === "agent_processing") return "本地客户端处理中";
  if (input.status === "session_expired") return "登录失效";
  if (input.status === "manual_required") return "需人工确认";
  if (input.status === "pending") return "待处理（历史插件任务）";

  const av = input.accountVerificationStatus;
  if (av === "matched") return "账号核验通过";
  if (av === "mismatched") return "账号不匹配";
  if (av === "login_required") return "需要登录";
  if (av === "unknown") return "无法识别账号";

  if (input.status === "failed") {
    const raw = input.agentErrorMessage ?? input.errorMessage;
    const parsed = parsePublishTaskErrorMessage(raw);
    if (parsed) return parsed.customerMessage;
    const msg = input.errorMessage ?? "";
    if (msg.includes("账号不匹配")) return "账号不匹配";
    if (msg.includes("无法识别")) return "无法识别账号";
    if (msg.includes("尚未绑定")) return "未绑定账号";
    return "发布失败";
  }

  return input.status;
}
