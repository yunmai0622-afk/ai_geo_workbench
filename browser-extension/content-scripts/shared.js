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

async function clickPublishButton() {
  const publishBtn =
    document.querySelector('button[type="submit"]') ||
    Array.from(document.querySelectorAll("button")).find(b => /发布|发表|提交/.test(b.textContent || ""));
  if (!publishBtn) throw new Error("找不到发布按钮");
  publishBtn.click();
  await sleep(3000);
}

/**
 * 经 background 下载封面（避免知乎页面跨域 fetch 失败）
 */
async function fetchImageAsFile(url, filename = "cover.jpg") {
  const resp = await chrome.runtime.sendMessage({ action: "fetchCoverImage", url });
  if (!resp?.ok) {
    throw new Error(resp?.error || "background 下载封面图失败");
  }
  const binary = atob(resp.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: resp.mimeType });
  return new File([blob], filename, { type: resp.mimeType });
}

function findZhihuCoverFileInput() {
  const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
  console.log(
    "[封面图] 页面 file input 数量:",
    inputs.length,
    inputs.map(inp => ({ accept: inp.accept, name: inp.name, hidden: inp.hidden })),
  );
  const imageInput = inputs.find(inp => {
    const accept = (inp.accept || "").toLowerCase();
    return !accept || accept.includes("image") || accept.includes("*");
  });
  return imageInput || inputs[0] || null;
}

async function openZhihuCoverPanel() {
  const clickables = Array.from(
    document.querySelectorAll('button, [role="button"], label, div, span, a'),
  );
  const trigger = clickables.find(el => {
    const text = (el.textContent || "").trim();
    return /添加封面|上传封面|文章封面|设置封面|更换封面|封面图/.test(text) && text.length <= 16;
  });
  if (trigger) {
    console.log("[封面图] 点击封面入口:", trigger.textContent?.trim());
    trigger.click();
    await sleep(1500);
    return true;
  }
  return false;
}

/**
 * 知乎封面图上传
 */
async function uploadZhihuCover(imageUrl) {
  if (!imageUrl) {
    console.warn("[封面图] 任务无 coverImageUrl，跳过上传");
    return;
  }

  try {
    console.log("[封面图] 开始上传:", imageUrl);
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

    const file = await fetchImageAsFile(imageUrl, "cover.jpg");
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

    if (isZhihuEditor() && task.coverImageUrl) {
      const titleInput = findZhihuTitleInput();
      if (titleInput && task.articleTitle) {
        setInputValue(titleInput, task.articleTitle);
        await sleep(500);
      }
      await uploadZhihuCover(task.coverImageUrl);
    }

    await fillTitleAndBody(task.articleTitle, task.articleContent);

    if (!isZhihuEditor() && task.coverImageUrl) {
      await uploadZhihuCover(task.coverImageUrl);
    }

    await clickPublishButton();
    console.log(`[shared] publishArticle 完成 url=${window.location.href}`);
    return { success: true, url: window.location.href };
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
