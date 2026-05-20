function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function markdownToHtml(markdown) {
  if (!markdown) return "";
  return markdown
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(.+)$/gm, "<p>$1</p>");
}

function markdownToPlainText(markdown) {
  if (!markdown) return "";
  return markdown
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, "")
    .trim();
}

function setInputValue(el, value) {
  if (!el) return;
  el.focus();
  if ("value" in el) {
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function setEditableHtml(el, html) {
  if (!el) return;
  el.focus();
  el.innerHTML = html;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * 使用 execCommand + insertText 模拟键盘输入
 * 这对 Draft.js 等富文本编辑器更友好
 */
function simulateTyping(el, text) {
  if (!el) return false;
  el.focus();
  // 先尝试 execCommand insertText（对 contenteditable 有效）
  const success = document.execCommand("insertText", false, text);
  if (success) return true;
  // fallback: 使用 InputEvent
  const inputEvent = new InputEvent("input", {
    bubbles: true,
    cancelable: true,
    inputType: "insertText",
    data: text,
  });
  el.dispatchEvent(inputEvent);
  return true;
}

/**
 * 检测当前是否在知乎编辑器页面
 */
function isZhihuEditor() {
  return window.location.hostname === "zhuanlan.zhihu.com" ||
    window.location.href.includes("zhihu.com/creator");
}

function isZhihuWritePage() {
  return /zhuanlan\.zhihu\.com\/write/.test(window.location.href);
}

/**
 * 知乎专用：查找标题输入框
 */
function findZhihuTitleInput() {
  // 知乎写文章页面的标题输入框
  return document.querySelector('textarea[placeholder*="标题"]') ||
    document.querySelector('input[placeholder*="标题"]') ||
    document.querySelector(".WriteIndex-titleInput") ||
    document.querySelector(".css-1ey8a9y") || // 知乎新版编辑器标题
    document.querySelector('[data-testid="article-title"]') ||
    document.querySelector('textarea.Input');
}

/**
 * 知乎专用：查找正文编辑器
 */
function findZhihuEditor() {
  // Draft.js 编辑器通常是 contenteditable div
  return document.querySelector(".DraftEditor-root [contenteditable='true']") ||
    document.querySelector(".public-DraftEditor-content") ||
    document.querySelector('[contenteditable="true"][data-contents="true"]') ||
    document.querySelector(".editable[contenteditable='true']") ||
    document.querySelector('[contenteditable="true"]');
}

async function fillTitleAndBody(title, contentMarkdown) {
  if (isZhihuEditor()) {
    // 知乎专用流程：使用模拟输入适配 Draft.js
    console.log("[shared] 检测到知乎编辑器，使用专用填充逻辑");

    // 等待编辑器加载
    let titleInput = null;
    let editor = null;
    for (let i = 0; i < 10; i++) {
      titleInput = findZhihuTitleInput();
      editor = findZhihuEditor();
      if (titleInput || editor) break;
      console.log(`[shared] 等待编辑器加载... (${i + 1}/10)`);
      await sleep(1000);
    }

    // 填充标题
    if (titleInput) {
      titleInput.focus();
      await sleep(300);
      // 清空现有内容
      titleInput.value = "";
      titleInput.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(200);
      // 使用 execCommand 模拟输入
      if (!simulateTyping(titleInput, title)) {
        // fallback: 直接设置 value
        setInputValue(titleInput, title);
      }
      console.log("[shared] 标题已填充");
      await sleep(500);
    } else {
      console.warn("[shared] 未找到标题输入框，跳过标题填充");
    }

    // 填充正文
    if (editor) {
      editor.focus();
      await sleep(300);
      // 清空现有内容
      document.execCommand("selectAll", false, null);
      await sleep(100);
      document.execCommand("delete", false, null);
      await sleep(300);
      // 尝试使用 execCommand insertText（对 Draft.js 最友好）
      const plainText = markdownToPlainText(contentMarkdown);
      const inserted = document.execCommand("insertText", false, plainText);
      if (!inserted) {
        // fallback: 使用 innerHTML（可能不被 Draft.js 识别）
        console.warn("[shared] execCommand 失败，尝试 innerHTML fallback");
        setEditableHtml(editor, markdownToHtml(contentMarkdown));
      }
      console.log("[shared] 正文已填充");
      await sleep(1000);
    } else {
      throw new Error("找不到正文编辑器");
    }
  } else {
    // 通用流程（其他平台）
    const titleInput =
      document.querySelector('[placeholder*="标题"]') ||
      document.querySelector(".WriteIndex-titleInput") ||
      document.querySelector('input[name="title"]') ||
      document.querySelector("textarea[placeholder*='标题']");

    if (titleInput) {
      setInputValue(titleInput, title);
      await sleep(500);
    }

    const editor =
      document.querySelector(".ql-editor") ||
      document.querySelector('[contenteditable="true"]') ||
      document.querySelector(".editor-content") ||
      document.querySelector(".ProseMirror");

    if (editor) {
      setEditableHtml(editor, markdownToHtml(contentMarkdown));
      await sleep(1000);
    } else {
      throw new Error("找不到正文编辑器");
    }
  }
}

function normalizeZhihuPublishedUrl(url) {
  return url.replace(/\/edit\/?(\?|#|$)/, "$1").replace(/\/edit$/, "");
}

/**
 * 知乎：必须点击「发布」并等待成功，不能把自动保存草稿的 /edit 页当成已发布
 */
async function clickZhihuPublishAndWait() {
  const urlBeforePublish = window.location.href;
  console.log("[发布] 当前页面（填稿后）:", urlBeforePublish);

  const publishBtn = Array.from(document.querySelectorAll("button, [role='button']")).find(b => {
    if (isInsideZhihuBodyEditor(b)) return false;
    const text = (b.textContent || "").trim();
    return text === "发布" || text === "发布文章";
  });

  if (!publishBtn) {
    throw new Error("找不到知乎「发布」按钮");
  }

  console.log("[发布] 点击知乎发布按钮");
  publishBtn.click();
  await sleep(2000);

  const confirmBtn = Array.from(document.querySelectorAll("button, [role='button']")).find(b => {
    const text = (b.textContent || "").trim();
    return /^确认发布$|^确定发布$|^确认$/.test(text);
  });
  if (confirmBtn) {
    console.log("[发布] 点击确认弹窗:", confirmBtn.textContent?.trim());
    confirmBtn.click();
    await sleep(1500);
  }

  let publishedUrl = null;
  for (let i = 0; i < 40; i += 1) {
    await sleep(1000);
    const href = window.location.href;
    const pageText = document.body.innerText || "";

    if (/发布成功|发表成功|已成功发布/.test(pageText)) {
      publishedUrl = normalizeZhihuPublishedUrl(href);
      console.log("[发布] 检测到发布成功文案");
      break;
    }

    if (i >= 5 && href.includes("/p/") && !href.includes("/write")) {
      publishedUrl = normalizeZhihuPublishedUrl(href);
      console.log("[发布] 页面已离开 write 且进入文章页，视为发布完成");
      break;
    }
  }

  if (!publishedUrl) {
    throw new Error("发布超时：未检测到发布成功（可能仅保存了草稿）");
  }

  console.log("[发布] 知乎发布成功，链接:", publishedUrl);
  return publishedUrl;
}

async function clickPublishButton(platform) {
  if (platform === "zhihu" || isZhihuEditor()) {
    return clickZhihuPublishAndWait();
  }

  const publishBtn =
    document.querySelector('button[type="submit"]') ||
    Array.from(document.querySelectorAll("button")).find(b => /发布|发表|提交/.test(b.textContent || ""));
  if (!publishBtn) throw new Error("找不到发布按钮");
  publishBtn.click();
  await sleep(5000);
  return window.location.href;
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

function describeFileInput(inp) {
  let hint = "";
  let node = inp.parentElement;
  for (let i = 0; i < 6 && node; i += 1) {
    const t = (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (t) hint = t;
    node = node.parentElement;
  }
  const rect = inp.getBoundingClientRect();
  return { accept: inp.accept, top: Math.round(rect.top), hint };
}

function findZhihuCoverFileInput() {
  const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
  const candidates = inputs.filter(inp => !isInsideZhihuBodyEditor(inp));

  console.log(
    "[封面图] file input 候选:",
    inputs.length,
    "排除编辑器后:",
    candidates.length,
    candidates.map(describeFileInput),
  );

  for (const inp of candidates) {
    let node = inp.parentElement;
    for (let depth = 0; depth < 10 && node; depth += 1, node = node.parentElement) {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (/文章封面|添加封面|封面设置|设置封面|上传封面|添加头图|头图/.test(text) && !/插入图片|插入|正文|图片上传/.test(text)) {
        console.log("[封面图] 选中封面区域 input:", describeFileInput(inp));
        return inp;
      }
    }
  }

  const byClass = candidates.find(inp => {
    let node = inp;
    for (let i = 0; i < 8 && node; i += 1, node = node.parentElement) {
      const cls = (node.className || "").toString().toLowerCase();
      if (/cover|poster|thumbnail|头图|article-cover/.test(cls)) return true;
    }
    return false;
  });
  if (byClass) {
    console.log("[封面图] 按 class 选中封面 input:", describeFileInput(byClass));
    return byClass;
  }

  if (candidates.length > 0) {
    const bottomMost = candidates.sort(
      (a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top,
    )[0];
    console.log("[封面图] 使用页面最下方非编辑器 input:", describeFileInput(bottomMost));
    return bottomMost;
  }

  return null;
}

async function openZhihuCoverPanel() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  await sleep(1000);

  const clickables = Array.from(
    document.querySelectorAll('button, [role="button"], label, div, span, a'),
  );
  const triggers = clickables.filter(el => {
    if (isInsideZhihuBodyEditor(el)) return false;
    const text = (el.textContent || "").trim();
    if (!text || text.length > 20) return false;
    return /添加封面|上传封面|文章封面|设置封面|更换封面|添加头图|头图/.test(text);
  });

  const trigger = triggers.sort(
    (a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top,
  )[0];

  if (trigger) {
    console.log("[封面图] 点击底部封面入口:", trigger.textContent?.trim());
    trigger.click();
    await sleep(2000);
    return true;
  }

  console.warn("[封面图] 未找到封面入口按钮，尝试直接定位 file input");
  return false;
}

/**
 * 知乎封面图上传
 */
async function uploadZhihuCover(task) {
  const imageUrl = task?.coverImageUrl;
  if (!imageUrl && !task?.coverImageBase64) {
    console.warn("[封面图] 任务无封面数据，跳过上传");
    return;
  }

  try {
    console.log(
      "[封面图] 开始上传:",
      imageUrl || "(仅 base64)",
      task?.coverImageBase64 ? "含内嵌 base64" : "无内嵌 base64",
    );
    await openZhihuCoverPanel();

    let coverInput = findZhihuCoverFileInput();
    if (!coverInput) {
      await sleep(1000);
      coverInput = findZhihuCoverFileInput();
    }

    if (!coverInput) {
      console.warn("[封面图] 未找到封面图 input，跳过上传");
      return;
    }

    const file = await fetchImageAsFile(imageUrl, "cover.jpg", task);
    const dt = new DataTransfer();
    dt.items.add(file);
    coverInput.files = dt.files;
    coverInput.dispatchEvent(new Event("change", { bubbles: true }));
    coverInput.dispatchEvent(new Event("input", { bubbles: true }));

    await sleep(5000);
    console.log("[封面图] 知乎封面图上传完成");
  } catch (e) {
    console.warn("[封面图] 上传失败（不影响发布）:", e);
  }
}

async function publishArticle(task) {
  try {
    console.log(
      `[shared] publishArticle 开始 platform=${task.platform} title=${task.articleTitle} coverImageUrl=${task.coverImageUrl || "(无)"}`,
    );

    const hasCover = Boolean(task.coverImageUrl || task.coverImageBase64);

    // 先填标题和正文，再上传底部封面（避免误用编辑器内「插入图片」的 file input）
    await fillTitleAndBody(task.articleTitle, task.articleContent);

    if (isZhihuWritePage() && hasCover) {
      await uploadZhihuCover(task);
    } else if (!isZhihuEditor() && hasCover) {
      await uploadZhihuCover(task);
    }

    const publishedUrl = await clickPublishButton(task.platform);
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
