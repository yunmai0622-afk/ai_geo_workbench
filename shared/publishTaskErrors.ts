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

/** Agent / 发布任务失败原因 → 客户可读文案（不暴露技术细节） */
export function customerMessageForAgentPublishFailure(
  raw: string | null | undefined,
  errorType?: string | null,
): string | null {
  if (!raw?.trim() && !errorType?.trim()) return null;
  const combined = `${errorType ?? ""} ${raw ?? ""}`.toLowerCase();

  if (combined.includes("profile_not_found")) {
    return "账号环境未找到，请重新绑定账号";
  }
  if (combined.includes("account_mismatch")) {
    return "登录账号与绑定账号不一致";
  }
  if (combined.includes("title_input_not_found")) {
    return "未找到标题输入框，请重试";
  }
  if (
    combined.includes("locator.count") ||
    combined.includes("target page") ||
    combined.includes("browser has been closed") ||
    combined.includes("page_context_lost")
  ) {
    return "发布过程中断，请重试";
  }

  const parsed = parsePublishTaskErrorMessage(raw);
  if (parsed && parsed.errorType !== "unknown") {
    return parsed.customerMessage;
  }

  if (raw?.includes("账号不匹配") || raw?.includes("account_mismatch")) {
    return "登录账号与绑定账号不一致";
  }
  if (raw?.includes("尚未绑定") || raw?.includes("profile_not_found")) {
    return "账号环境未找到，请重新绑定账号";
  }

  return "发布失败，请重试或联系支持";
}

export function publishTaskStatusCustomerLabel(input: {
  status: string;
  accountVerificationStatus?: string | null;
  errorMessage?: string | null;
  agentErrorMessage?: string | null;
}): string {
  if (input.status === "pending") return "待发布";
  if (input.status === "pending_agent") return "等待客户端处理";
  if (input.status === "copied") return "已复制";
  if (input.status === "manual_required") return "需人工确认";
  if (input.status === "draft_saved") return "草稿已保存，请在平台确认发布";
  if (input.status === "completed") return "已发布";
  if (input.status === "failed") return "发布失败";
  if (input.status === "processing") return "发布中";
  if (input.status === "agent_processing") return "客户端处理中";
  if (input.status === "session_expired") return "登录失效，请重新绑定";

  const av = input.accountVerificationStatus;
  if (av === "matched") return "账号核验通过";
  if (av === "mismatched") return "登录账号与绑定账号不一致";
  if (av === "login_required") return "需要登录";
  if (av === "unknown") return "无法识别账号";

  return input.status;
}
