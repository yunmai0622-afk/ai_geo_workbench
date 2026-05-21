function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Markdown 转纯文本（保留换行，去掉 HTML 标签）
 */
function markdownToPlainText(markdown) {
  if (!markdown) return "";
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 检测当前是否在知乎编辑器页面
 */
function isZhihuEditor() {
  return window.location.hostname === "zhuanlan.zhihu.com" ||
    window.location.href.includes("zhihu.com/creator");
}

async function fillTitleAndBody(title, contentMarkdown) {
  const titleInput =
    document.querySelector('textarea[placeholder*="标题"]') ||
    document.querySelector("textarea.Input") ||
    document.querySelector("textarea");

  if (titleInput) {
    titleInput.focus();
    const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    if (nativeTextareaSetter) {
      nativeTextareaSetter.call(titleInput, title);
    } else {
      titleInput.value = title;
    }
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    titleInput.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(500);
  }

  const editor = document.querySelector(".public-DraftEditor-content");
  if (!editor) throw new Error("找不到正文编辑器（.public-DraftEditor-content）");

  editor.click();
  editor.focus();
  await sleep(2000);

  document.execCommand("selectAll", false, null);
  document.execCommand("delete", false, null);
  await sleep(300);

  const plainText = markdownToPlainText(contentMarkdown);
  document.execCommand("insertText", false, plainText);
  await sleep(1000);
}

function normalizeZhihuPublishedUrl(url) {
  return url.replace(/\/edit\/?(\?|#|$)/, "$1").replace(/\/edit$/, "");
}

async function clickPublishButton() {
  // 知乎「发布文章」按钮 — 直接发布，无二次弹窗
  const btn =
    document.querySelector("button.WriteIndex-publishButton") ||
    document.querySelector('button[class*="publishButton"]') ||
    document.querySelector('button[class*="PublishButton"]') ||
    document.querySelector('button[class*="publish-button"]') ||
    document.querySelector('button[type="submit"]') ||
    Array.from(document.querySelectorAll("button")).find(b => {
      if (isInsideZhihuBodyEditor(b)) return false;
      const txt = b.textContent?.trim() ?? "";
      if (/保存草稿|存草稿|草稿/.test(txt)) return false;
      return txt === "发布文章" || txt === "发布" || txt === "发表文章" || /发布|发表|提交/.test(txt);
    });

  if (!btn) throw new Error("找不到发布按钮");

  console.log(`[发布] 点击发布按钮: "${btn.textContent?.trim()}"`);
  btn.click();

  await sleep(5000);

  const href = window.location.href;
  return isZhihuEditor() ? normalizeZhihuPublishedUrl(href) : href;
}

function fileFromBase64(base64, mimeType, filename = "cover.jpg") {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

/**
 * 优先使用任务内嵌的 base64（服务端 pending 已代理下载），否则经 background 拉取 URL
 */
async function fetchImageAsFile(url, filename = "cover.jpg", task) {
  if (task?.coverImageBase64) {
    console.log("[封面图] 使用服务端下发的 base64 数据");
    return fileFromBase64(task.coverImageBase64, task.coverImageMime || "image/png", filename);
  }

  const resp = await chrome.runtime.sendMessage({ action: "fetchCoverImage", url });
  if (!resp?.ok) {
    throw new Error(resp?.error || "background 下载封面图失败");
  }
  return fileFromBase64(resp.base64, resp.mimeType || "image/jpeg", filename);
}

function isInsideZhihuBodyEditor(el) {
  return !!el.closest(
    ".DraftEditor-root, .public-DraftEditor-content, .DraftEditor-editorContainer, [class*='DraftEditor'], [class*='RichTextEditor'], [class*='Editor'] [class*='toolbar'], [class*='Toolbar']",
  );
}

function findZhihuCoverInput() {
  const inputs = document.querySelectorAll("input.UploadPicture-input");
  if (inputs.length >= 2) return inputs[1];
  return inputs[0] ?? null;
}

async function uploadZhihuCover(imageUrl, task) {
  if (!imageUrl && !task?.coverImageBase64) return;

  try {
    const coverInput = findZhihuCoverInput();

    if (!coverInput) {
      console.warn("[封面图] 未找到 input.UploadPicture-input，跳过上传");
      return;
    }

    console.log(
      `[封面图] 使用 UploadPicture-input（共 ${document.querySelectorAll("input.UploadPicture-input").length} 个）`,
    );

    const file = await fetchImageAsFile(imageUrl, "cover.jpg", task);

    const dt = new DataTransfer();
    dt.items.add(file);
    coverInput.files = dt.files;

    coverInput.dispatchEvent(new Event("change", { bubbles: true }));
    coverInput.dispatchEvent(new Event("input", { bubbles: true }));

    await sleep(4000);
    console.log("[封面图] 知乎封面图上传完成");
  } catch (e) {
    console.warn("[封面图] 上传失败（不影响发布）:", e);
  }
}

async function waitForEditor(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const editor = document.querySelector(".public-DraftEditor-content");
    if (editor) return editor;
    await sleep(500);
  }
  throw new Error("等待编辑器超时");
}

async function publishArticle(task) {
  try {
    console.log(
      `[shared] publishArticle 开始 platform=${task.platform} title=${task.articleTitle} coverImageUrl=${task.coverImageUrl || "(无)"}`,
    );

    await waitForEditor();
    await sleep(1000);

    await fillTitleAndBody(task.articleTitle, task.articleContent);

    if (task.coverImageUrl || task.coverImageBase64) {
      await uploadZhihuCover(task.coverImageUrl, task);
    }

    await sleep(2000);

    const publishedUrl = await clickPublishButton();
    console.log(`[shared] publishArticle 发布流程结束 url=${publishedUrl}`);
    return { success: true, url: publishedUrl, published: true };
  } catch (e) {
    console.error(`[shared] publishArticle 失败:`, e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function reportPlatformLogin(platform, isLogin) {
  chrome.storage.local.get(["platformStatus"], result => {
    const status = result.platformStatus || {};
    status[platform] = Boolean(isLogin);
    chrome.storage.local.set({ platformStatus: status });
  });
}
