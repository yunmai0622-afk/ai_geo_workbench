window.PlatformAdapters.sohu = {
  platform: "sohu",
  publishUrl: "https://mp.sohu.com/mpfe/v3/submit",

  async waitPageReady(task) {
    if (!window.location.hostname.includes("sohu.com")) {
      throw publishCreateError("publish_page_not_found", "wait_page_ready", "非搜狐号发布页");
    }
    await publishSleep(2000);
    if (publishDetectLoginRequired()) {
      throw publishCreateError("login_required", "wait_page_ready", "搜狐号未登录");
    }
  },

  async trySelectDefaultCategory(task) {
    const categoryLabels = ["科技", "财经", "教育", "互联网", "综合", "其他"];
    const trigger = document.querySelector(
      '.category, [class*="category"], [placeholder*="分类"], [placeholder*="栏目"]',
    );
    if (!trigger) return false;

    trigger.click();
    await publishSleep(800);
    for (const label of categoryLabels) {
      const opt = Array.from(document.querySelectorAll("li, div, span, button")).find(
        el => el.textContent?.trim() === label && el.offsetParent !== null,
      );
      if (opt) {
        opt.click();
        await publishSleep(500);
        publishLog(task, "close_blocking_dialogs", { selector: label, result: "category_selected" });
        return true;
      }
    }
    return false;
  },

  async waitEditorReady(task) {
    const bodyText = document.body?.innerText ?? "";
    if (/请选择分类|选择栏目|请选择频道/.test(bodyText)) {
      const picked = await this.trySelectDefaultCategory(task);
      if (!picked) {
        throw publishCreateError("category_required", "wait_editor_ready", "需要选择分类/栏目");
      }
      await publishSleep(1000);
    }

    await publishWaitForSelector(
      [
        'input[placeholder*="标题"]',
        'textarea[placeholder*="标题"]',
        ".title-input input",
        ".article-title input",
        "#title",
      ],
      25000,
      "wait_editor_ready",
      task,
    );
    await publishWaitForSelector(
      [
        ".ql-editor",
        ".ProseMirror",
        '[contenteditable="true"]',
        ".editor-content",
        "textarea.content",
      ],
      25000,
      "wait_editor_ready",
      task,
    );
  },

  async fillTitle(task) {
    const { el } = await publishWaitForSelector(
      [
        'input[placeholder*="标题"]',
        'textarea[placeholder*="标题"]',
        ".title-input input",
        ".article-title input",
        "#title",
      ],
      15000,
      "fill_title",
      task,
    );
    publishSetNativeValue(el, task.articleTitle ?? "");
    await publishSleep(600);
  },

  async fillContent(task) {
    try {
      const ql = document.querySelector(".ql-editor");
      if (ql) {
        await publishPasteIntoElement(ql, publishMarkdownToPlain(task.articleContent ?? ""));
        return;
      }
      await publishFillContentEditable(
        [".ProseMirror", ".editor-content", '[contenteditable="true"]', "textarea.content"],
        task.articleContent ?? "",
        task,
        "fill_content",
      );
    } catch (e) {
      throw publishCreateError(
        "content_injection_failed",
        "fill_content",
        e instanceof Error ? e.message : String(e),
      );
    }
  },

  async uploadCover(task) {
    const result = await publishUploadCoverInput(
      [
        'input[type="file"][accept*="image"]',
        ".cover-upload input",
        '[class*="cover"] input[type="file"]',
        'input[type="file"]',
      ],
      task,
      "upload_cover",
    );
    return { ok: result.ok, required: false, error: result.error?.message };
  },

  async submitOrSave(task) {
    const draftBtn = publishFindButton([/保存草稿/, /存草稿/]);
    if (draftBtn) {
      draftBtn.click();
      await publishSleep(5000);
      return { isDraft: true, draftSaved: true };
    }
    const pub = publishFindButton([/^发布$/, /立即发布/, /提交/, /发表/]);
    if (pub) {
      pub.click();
      await publishSleep(5000);
      return { isDraft: false, draftSaved: false };
    }
    throw publishCreateError("submit_button_not_found", "submit_or_save", "搜狐号无发布按钮");
  },

  verifySuccess(task, { urlBefore }) {
    return publishVerifyPublished(urlBefore) || (publishVerifyDraftSaved() ? window.location.href : null);
  },
};
