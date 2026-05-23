/**
 * 发布流水线公共工具 + 状态机（C7-C）
 */
window.PlatformAdapters = window.PlatformAdapters || {};

function publishSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function publishMarkdownToPlain(markdown) {
  if (!markdown) return "";
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function publishLog(task, step, extra = {}) {
  const platform = task?.platform ?? "?";
  const taskId = task?.id ?? "?";
  const parts = [
    `[发布][${platform}][task=${taskId}]`,
    `step=${step}`,
    `result=${extra.result ?? "ok"}`,
  ];
  if (extra.selector) parts.push(`selector=${extra.selector}`);
  if (extra.elapsedMs != null) parts.push(`elapsedMs=${extra.elapsedMs}`);
  if (extra.errorType) parts.push(`errorType=${extra.errorType}`);
  if (extra.errorMessage) parts.push(`msg=${extra.errorMessage}`);
  if (task?.projectId != null) parts.push(`projectId=${task.projectId}`);
  if (task?.projectName) parts.push(`projectName=${task.projectName}`);
  if (task?.expectedAccountName) parts.push(`expected=${task.expectedAccountName}`);
  if (extra.detectedAccountName !== undefined) parts.push(`detected=${extra.detectedAccountName ?? "(空)"}`);
  console.log(parts.join(" "));
}

function publishFailPayload(errorType, step, detail, selector) {
  const customerMap = {
    login_required: "当前平台未登录或登录已失效，请登录绑定账号后重试。",
    captcha_or_verify: "遇到验证码或安全验证，请人工完成验证后重试。",
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
  const customerMessage =
    (customerMap[errorType] ?? customerMap.unknown) +
    (step && (errorType === "timeout" || errorType === "editor_not_found" || errorType === "editor_not_ready")
      ? `（步骤：${step}）`
      : "");
  const payload = {
    errorType,
    step,
    customerMessage,
    detail,
    selector,
  };
  return {
    success: false,
    ...payload,
    errorMessage: JSON.stringify(payload),
  };
}

function publishCreateError(errorType, step, detail, selector) {
  const err = new Error(detail || customerMessageForType(errorType, step));
  err.errorType = errorType;
  err.step = step;
  err.selector = selector;
  return err;
}

function customerMessageForType(errorType, step) {
  return publishFailPayload(errorType, step, "", "").customerMessage;
}

async function publishWaitForSelector(selectors, timeoutMs, step, task) {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const sel of list) {
      const el = document.querySelector(sel);
      if (el) {
        publishLog(task, step, { selector: sel, elapsedMs: Date.now() - start });
        return { el, selector: sel };
      }
    }
    await publishSleep(400);
  }
  publishLog(task, step, {
    result: "timeout",
    errorType: "editor_not_found",
    selector: list.join("|"),
    elapsedMs: Date.now() - start,
  });
  throw publishCreateError(
    "editor_not_found",
    step,
    `未找到元素: ${list.join(", ")}`,
    list[0],
  );
}

function publishDetectLoginRequired() {
  const href = window.location.href;
  if (/passport|login|signin|auth|sso/i.test(href)) return true;
  const body = document.body?.innerText ?? "";
  if (/请登录|立即登录|扫码登录/.test(body) && document.querySelector('input[type="password"], .login, [class*="login"]')) {
    return true;
  }
  return false;
}

function publishDetectCaptcha() {
  const body = document.body?.innerText ?? "";
  if (!/验证码|安全验证|人机验证|滑块验证|图形验证/.test(body)) return false;
  return Boolean(
    document.querySelector(
      'iframe[src*="captcha"], [class*="captcha"], [id*="captcha"], .geetest, .yidun, [class*="verify"]',
    ),
  );
}

async function publishCloseBlockingDialogs() {
  const labels = ["知道了", "我知道了", "稍后再说", "下次再说", "关闭", "跳过", "暂不", "继续编辑"];
  for (let i = 0; i < 3; i += 1) {
    let clicked = false;
    for (const label of labels) {
      const btn = Array.from(document.querySelectorAll("button, a, span, div")).find(el => {
        const t = el.textContent?.trim();
        return t === label && el.offsetParent !== null;
      });
      if (btn) {
        btn.click();
        clicked = true;
        await publishSleep(400);
      }
    }
    if (!clicked) break;
  }
}

function publishFileFromBase64(base64, mimeType, filename = "cover.jpg") {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mimeType });
}

async function publishFetchCoverFile(url, task) {
  if (task?.coverImageBase64) {
    return publishFileFromBase64(task.coverImageBase64, task.coverImageMime || "image/png", "cover.png");
  }
  const resp = await chrome.runtime.sendMessage({ action: "fetchCoverImage", url });
  if (!resp?.ok) throw new Error(resp?.error || "background 下载封面图失败");
  return publishFileFromBase64(resp.base64, resp.mimeType || "image/jpeg", "cover.jpg");
}

async function publishUploadCoverInput(selectors, task, step) {
  if (!task.coverImageUrl && !task.coverImageBase64) {
    publishLog(task, "upload_cover", { result: "skip", detail: "no_cover" });
    return { ok: true, skipped: true };
  }
  try {
    const { el } = await publishWaitForSelector(selectors, 12000, step, task);
    const file = await publishFetchCoverFile(task.coverImageUrl, task);
    const dt = new DataTransfer();
    dt.items.add(file);
    el.files = dt.files;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await publishSleep(3000);
    publishLog(task, "upload_cover", { result: "ok" });
    return { ok: true };
  } catch (e) {
    publishLog(task, "upload_cover", {
      result: "failed",
      errorType: "cover_upload_failed",
      errorMessage: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, error: e };
  }
}

function publishSetNativeValue(el, value) {
  if (!el) return;
  const tag = el.tagName?.toLowerCase();
  if (tag === "textarea" || tag === "input") {
    const proto =
      tag === "textarea" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  if (el.isContentEditable) {
    el.focus();
    el.textContent = value;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
  }
}

async function publishPasteIntoElement(el, plainText) {
  el.focus();
  el.click();
  await publishSleep(300);
  document.execCommand("selectAll", false, null);
  document.execCommand("delete", false, null);
  const clipboardData = new DataTransfer();
  clipboardData.setData("text/plain", plainText);
  el.dispatchEvent(
    new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }),
  );
  await publishSleep(800);
}

async function publishFillContentEditable(selectors, markdown, task, step) {
  const plain = publishMarkdownToPlain(markdown);
  const { el } = await publishWaitForSelector(selectors, 20000, step, task);
  if (!el.isContentEditable && !el.querySelector?.('[contenteditable="true"]')) {
    throw publishCreateError("editor_not_ready", step, "正文区域不可编辑", selectors[0]);
  }
  const target = el.isContentEditable ? el : el.querySelector('[contenteditable="true"]') || el;
  await publishPasteIntoElement(target, plain);
  return target;
}

function publishFindButton(textPatterns, excludePatterns = []) {
  return Array.from(document.querySelectorAll("button, a, [role='button'], span")).find(el => {
    if (el.offsetParent === null) return false;
    const txt = el.textContent?.trim() ?? "";
    if (!txt) return false;
    if (excludePatterns.some(p => p.test(txt))) return false;
    return textPatterns.some(p => p.test(txt));
  });
}

async function publishClickSubmitOrSave(task, options = {}) {
  const publishPatterns = options.publishPatterns ?? [/^发布$/, /^发布文章$/, /^立即发布$/];
  const draftPatterns = options.draftPatterns ?? [/存草稿/, /保存草稿/, /保存$/];
  const preferDraft = options.preferDraft === true;

  let btn = preferDraft
    ? publishFindButton(draftPatterns)
    : publishFindButton(publishPatterns, [/存草稿/, /保存草稿/]);
  if (!btn) btn = publishFindButton(draftPatterns);
  if (!btn) btn = publishFindButton(publishPatterns);

  if (!btn) {
    throw publishCreateError("submit_button_not_found", "submit_or_save", "未找到发布/保存按钮");
  }

  const isDraft = draftPatterns.some(p => p.test(btn.textContent?.trim() ?? ""));
  publishLog(task, "submit_or_save", { selector: btn.textContent?.trim(), result: isDraft ? "draft" : "publish" });
  btn.click();
  await publishSleep(options.waitAfterMs ?? 5000);
  return { isDraft, clickedText: btn.textContent?.trim() };
}

function publishVerifyDraftSaved() {
  const body = document.body?.innerText ?? "";
  return /草稿|已保存|保存成功/.test(body);
}

function publishVerifyPublished(urlBefore) {
  const href = window.location.href;
  if (href !== urlBefore && !/\/edit|\/publish|\/submit|\/write/.test(href)) return href;
  const body = document.body?.innerText ?? "";
  if (/发布成功|提交成功|已发布/.test(body)) return href;
  return null;
}

async function publishRunStep(task, step, fn, maxAttempts = 2) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const start = Date.now();
    try {
      publishLog(task, step, { result: "start", detail: `attempt=${attempt}` });
      const out = await fn();
      publishLog(task, step, { result: "ok", elapsedMs: Date.now() - start });
      return out;
    } catch (e) {
      lastErr = e;
      const retryable = ["wait_editor_ready", "fill_title", "fill_content", "close_blocking_dialogs"].includes(step);
      publishLog(task, step, {
        result: "error",
        errorType: e?.errorType ?? "unknown",
        errorMessage: e instanceof Error ? e.message : String(e),
        elapsedMs: Date.now() - start,
      });
      if (!retryable || attempt >= maxAttempts) break;
      await publishSleep(1500);
      await publishCloseBlockingDialogs();
    }
  }
  throw lastErr;
}

window.runPlatformPublish = async function runPlatformPublish(task) {
  const adapter = window.PlatformAdapters[task.platform];
  if (!adapter) {
    return publishFailPayload("unknown", "init", `未知平台: ${task.platform}`);
  }

  try {
    publishLog(task, "open_publish_page", { result: "ok" });

    if (publishDetectLoginRequired()) {
      return publishFailPayload("login_required", "detect_account", "页面处于登录态");
    }
    if (publishDetectCaptcha()) {
      return publishFailPayload("captcha_or_verify", "detect_account", "检测到验证码/安全验证");
    }

    await publishRunStep(task, "wait_page_ready", () => adapter.waitPageReady(task));
    await publishRunStep(task, "close_blocking_dialogs", publishCloseBlockingDialogs);
    await publishRunStep(task, "wait_editor_ready", () => adapter.waitEditorReady(task));
    await publishRunStep(task, "fill_title", () => adapter.fillTitle(task));
    await publishRunStep(task, "fill_content", () => adapter.fillContent(task));

    const coverResult = await adapter.uploadCover(task);
    if (coverResult?.required && coverResult?.ok === false) {
      return publishFailPayload("cover_upload_failed", "upload_cover", coverResult.error ?? "");
    }

    const urlBefore = window.location.href;
    const submit = await publishRunStep(task, "submit_or_save", () => adapter.submitOrSave(task));
    const verifiedUrl = adapter.verifySuccess(task, { urlBefore, ...submit });

    if (submit.isDraft || submit.draftSaved) {
      if (!verifiedUrl && !publishVerifyDraftSaved()) {
        return publishFailPayload("submit_failed", "verify_success", "草稿保存未确认");
      }
      publishLog(task, "verify_success", { result: "draft_saved" });
      return {
        success: true,
        published: false,
        draftSaved: true,
        url: verifiedUrl || urlBefore,
      };
    }

    if (!verifiedUrl) {
      return publishFailPayload("submit_failed", "verify_success", "未检测到发布成功");
    }
    publishLog(task, "verify_success", { result: "published", detail: verifiedUrl });
    return { success: true, published: true, draftSaved: false, url: verifiedUrl };
  } catch (e) {
    const errorType = e?.errorType ?? "unknown";
    const step = e?.step ?? "unknown";
    publishLog(task, step, {
      result: "failed",
      errorType,
      errorMessage: e instanceof Error ? e.message : String(e),
      selector: e?.selector,
    });
    return publishFailPayload(errorType, step, e instanceof Error ? e.message : String(e), e?.selector);
  }
};
