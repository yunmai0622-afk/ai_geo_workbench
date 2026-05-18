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

async function fillTitleAndBody(title, contentMarkdown) {
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

async function clickPublishButton() {
  const publishBtn =
    document.querySelector('button[type="submit"]') ||
    Array.from(document.querySelectorAll("button")).find(b => /发布|发表|提交/.test(b.textContent || ""));
  if (!publishBtn) throw new Error("找不到发布按钮");
  publishBtn.click();
  await sleep(3000);
}

async function publishArticle(task) {
  try {
    await fillTitleAndBody(task.articleTitle, task.articleContent);
    await clickPublishButton();
    return { success: true, url: window.location.href };
  } catch (e) {
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
