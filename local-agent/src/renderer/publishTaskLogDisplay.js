/** 发布任务步骤日志 → 客户可读文案（Local Agent 诊断页） */

const HIDDEN_STEPS = new Set(["identity_debug", "publish_page", "publish_action"]);

const FINAL_STATUS_LABELS = {
  completed: "已发布",
  draft_saved: "草稿已保存",
  manual_required: "需人工确认",
  failed: "发布失败",
  session_expired: "登录失效",
};

function extractAccountDisplayName(message) {
  const msg = (message ?? "").trim();
  if (!msg) return "已识别";
  const bound = msg.match(/^(.+?)（绑定账号）$/);
  if (bound?.[1]) return bound[1].trim();
  if (/昵称待识别/.test(msg)) return "昵称待识别";
  if (/已登录/.test(msg)) return "已登录";
  if (msg === "未识别到昵称") return "未识别到昵称";
  return msg.replace(/（绑定账号）$/, "").trim() || "已识别";
}

function extractContentCharCount(message) {
  const msg = (message ?? "").trim();
  const m = msg.match(/正文\s*(\d+)\s*字/);
  if (m?.[1]) return m[1];
  const partial = msg.match(/（标题需人工）/);
  if (partial) return "部分";
  return null;
}

function customerizeTaskError(raw) {
  const msg = (raw ?? "").trim();
  if (!msg) return "";
  const lower = msg.toLowerCase();
  if (lower.includes("profile_not_found")) return "账号环境未找到，请在客户端重新绑定账号";
  if (lower.includes("account_mismatch") || msg.includes("账号不一致")) return "登录账号与绑定账号不一致，请重新登录";
  if (lower.includes("title_input_not_found") || msg.includes("未找到标题")) return "未能自动填入标题，请在浏览器中手动补全";
  if (lower.includes("content_input_not_found") || msg.includes("未找到正文")) return "未能自动填入正文，请在浏览器中手动补全";
  if (
    lower.includes("locator.count") ||
    lower.includes("target page") ||
    lower.includes("browser has been closed") ||
    lower.includes("page_context_lost")
  ) {
    return "发布过程中断，请重试";
  }
  if (lower.includes("login_required") || msg.includes("未登录") || msg.includes("登录失效")) {
    return "账号未登录或登录已失效，请重新登录";
  }
  if (msg.includes("验证码") || lower.includes("captcha")) return "遇到验证码，请在浏览器窗口人工完成";
  if (msg.includes("人工") || msg.includes("手动")) return msg;
  if (/^[a-z0-9_.-]+$/i.test(msg) && msg.includes("_")) return "发布失败，请重试或联系支持";
  if (msg.length > 120) return "发布失败，请重试或联系支持";
  return msg;
}

/**
 * @param {{ step: string, status: string, message?: string, selector?: string, createdAt?: string }} entry
 * @param {string} platformLabel 如「知乎」
 * @returns {string|null} null 表示不向客户展示
 */
function formatPublishTaskLogLine(entry, platformLabel) {
  const step = entry.step ?? "";
  const status = entry.status ?? "ok";
  const message = entry.message ?? "";

  if (HIDDEN_STEPS.has(step)) return null;

  switch (step) {
    case "open_home":
      return status === "ok" ? `✅ 打开${platformLabel}` : `⚠️ 打开${platformLabel}失败`;

    case "detect_account":
      if (status === "ok") {
        return `✅ 账号识别：${extractAccountDisplayName(message)}`;
      }
      if (message.includes("账号不一致")) return "⚠️ 账号识别失败：与绑定账号不一致";
      if (message.includes("未登录")) return "⚠️ 账号识别失败：未登录";
      return "⚠️ 账号识别失败";

    case "open_write":
      if (status === "ok") return "✅ 打开写作页";
      if (status === "skipped") return "ℹ️ 需手动进入写作页";
      return "⚠️ 未能打开写作页";

    case "fill_title":
      if (status === "ok") return "✅ 填入标题";
      return "⚠️ 未能填入标题";

    case "fill_content":
      if (status === "ok") {
        const n = extractContentCharCount(message);
        if (n === "部分") return "✅ 填入正文（部分，标题需人工补全）";
        if (n) return `✅ 填入正文（${n}字）`;
        return "✅ 填入正文";
      }
      return "⚠️ 未能填入正文";

    case "upload_cover":
      if (status === "ok") return "✅ 上传封面";
      if (/no_cover|cover_upload_skipped|无封面/.test(message)) return "ℹ️ 跳过封面（无封面图）";
      if (/cover_input_not_found/.test(message)) return "ℹ️ 跳过封面（未找到上传入口）";
      return "ℹ️ 跳过封面";

    case "save_draft":
      if (status === "ok") return "✅ 草稿已保存";
      return "ℹ️ 草稿待人工确认";

    case "click_publish_button":
      if (status === "ok") return "✅ 点击发布";
      return `⚠️ ${customerizeTaskError(message) || "未找到发布按钮"}`;

    case "confirm_publish_dialog":
      if (status === "ok") return "✅ 确认发布弹窗";
      if (status === "skipped") return "ℹ️ 无发布确认弹窗";
      return `⚠️ ${customerizeTaskError(message) || "确认发布失败"}`;

    case "wait_publish_success":
      if (status === "ok") return "✅ 发布成功";
      return `⚠️ ${customerizeTaskError(message) || "等待发布成功超时"}`;

    case "extract_public_url":
      if (status === "ok") return "✅ 已获取公开链接";
      return `⚠️ ${customerizeTaskError(message) || "未能提取公开链接"}`;

    case "publish_article":
      if (status === "ok") return "✅ 发布成功";
      return `⚠️ 发布失败${message ? `：${customerizeTaskError(message)}` : ""}`;

    case "publish_flow":
      if (status === "ok") return "✅ 发布成功";
      return `⚠️ 发布失败：${customerizeTaskError(message) || "请重试"}`;

    default:
      if (/^https?:\/\//i.test(message)) return null;
      if (status === "failed") return `⚠️ ${step}：${customerizeTaskError(message) || "步骤失败"}`;
      if (status === "skipped") return `ℹ️ ${step}${message ? `：${message}` : ""}`;
      return null;
  }
}

function formatPublishTaskLogHeader(log, platformLabel) {
  const statusLabel = FINAL_STATUS_LABELS[log.finalStatus] ?? log.finalStatus ?? "进行中";
  const lines = [`任务 #${log.taskId} · ${platformLabel} · ${statusLabel}`];
  const finished = log.finishedAt ?? log.updatedAt;
  if (finished) {
    const d = new Date(finished);
    if (!Number.isNaN(d.getTime())) {
      lines.push(`完成时间：${d.toLocaleString("zh-CN")}`);
    }
  }
  const err = customerizeTaskError(log.errorMessage);
  if (err && log.finalStatus !== "completed" && log.finalStatus !== "draft_saved") {
    lines.push("");
    lines.push(`失败说明：${err}`);
  }
  return lines.join("\n");
}

function formatPublishTaskLogsForCustomer(log, platformLabel) {
  const header = formatPublishTaskLogHeader(log, platformLabel);
  const steps = [];
  for (const entry of log.logs ?? []) {
    const line = formatPublishTaskLogLine(entry, platformLabel);
    if (line) steps.push(line);
  }
  const body =
    steps.length > 0
      ? ["", "执行步骤", ...steps].join("\n")
      : ["", "暂无步骤记录"].join("\n");
  return `${header}${body}`;
}

function formatPublishTaskLogsRaw(log) {
  return (log.logs ?? [])
    .map((l) => `${l.createdAt ?? ""}  ${l.step}  [${l.status}]  ${l.message ?? ""}${l.selector ? `  @${l.selector}` : ""}`)
    .join("\n");
}

function formatPublishTaskLogCopyText(log, platformLabel) {
  const customer = formatPublishTaskLogsForCustomer(log, platformLabel);
  const raw = formatPublishTaskLogsRaw(log);
  return `${customer}\n\n--- 原始日志（技术支持） ---\n${raw}${log.errorMessage ? `\n\nerror: ${log.errorMessage}` : ""}`;
}

globalThis.PublishTaskLogDisplay = {
  HIDDEN_STEPS,
  FINAL_STATUS_LABELS,
  customerizeTaskError,
  formatPublishTaskLogLine,
  formatPublishTaskLogHeader,
  formatPublishTaskLogsForCustomer,
  formatPublishTaskLogsRaw,
  formatPublishTaskLogCopyText,
};
