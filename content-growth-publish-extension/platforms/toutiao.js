window.PlatformAdapters.toutiao = {
  platform: "toutiao",
  publishUrl: "https://mp.toutiao.com/profile_v4/graphic/publish",

  findEditorInIframes() {
    const frames = document.querySelectorAll("iframe");
    for (const frame of frames) {
      try {
        const doc = frame.contentDocument;
        if (!doc) continue;
        const ed =
          doc.querySelector(".ProseMirror") ||
          doc.querySelector('[contenteditable="true"]') ||
          doc.querySelector(".public-DraftEditor-content");
        if (ed) return { doc, ed };
      } catch {
        /* cross-origin */
      }
    }
    return null;
  },

  async waitPageReady(task) {
    if (!window.location.hostname.includes("toutiao.com")) {
      throw publishCreateError("publish_page_not_found", "wait_page_ready", "非头条号发布页");
    }
    await publishSleep(2000);
    if (publishDetectLoginRequired()) {
      throw publishCreateError("login_required", "wait_page_ready", "头条号未登录");
    }
  },

  async waitEditorReady(task) {
    try {
      await publishWaitForSelector(
        [
          'textarea[placeholder*="标题"]',
          'textarea[placeholder*="请输入标题"]',
          ".title-wrapper textarea",
          ".publish-editor-title textarea",
          "textarea",
        ],
        25000,
        "wait_editor_ready",
        task,
      );
    } catch (e) {
      throw e;
    }
    const iframeEd = this.findEditorInIframes();
    if (iframeEd) {
      publishLog(task, "wait_editor_ready", { selector: "iframe.contenteditable", result: "ok" });
      return;
    }
    await publishWaitForSelector(
      [
        ".ProseMirror",
        ".public-DraftEditor-content",
        '[contenteditable="true"]',
        ".editor-kit-editor-container",
        ".article-editor",
      ],
      25000,
      "wait_editor_ready",
      task,
    );
  },

  async fillTitle(task) {
    const { el } = await publishWaitForSelector(
      [
        'textarea[placeholder*="标题"]',
        'textarea[placeholder*="请输入标题"]',
        ".title-wrapper textarea",
        ".publish-editor-title textarea",
      ],
      15000,
      "fill_title",
      task,
    );
    publishSetNativeValue(el, task.articleTitle ?? "");
    await publishSleep(600);
  },

  async fillContent(task) {
    const iframeEd = this.findEditorInIframes();
    const plain = publishMarkdownToPlain(task.articleContent ?? "");
    if (iframeEd) {
      await publishPasteIntoElement(iframeEd.ed, plain);
      return;
    }
    try {
      await publishFillContentEditable(
        [
          ".ProseMirror",
          ".public-DraftEditor-content",
          ".editor-kit-editor-container [contenteditable='true']",
          '[contenteditable="true"]',
        ],
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
        ".article-cover input[type='file']",
        '[class*="cover"] input[type="file"]',
        'input[type="file"]',
      ],
      task,
      "upload_cover",
    );
    return { ok: result.ok, required: false, error: result.error?.message };
  },

  async submitOrSave(task) {
    const draftBtn = publishFindButton([/存草稿/, /保存草稿/]);
    if (draftBtn) {
      draftBtn.click();
      await publishSleep(5000);
      return { isDraft: true, draftSaved: true };
    }
    const pub = publishFindButton([/^发布$/, /立即发布/, /提交/]);
    if (pub) {
      pub.click();
      await publishSleep(5000);
      return { isDraft: false, draftSaved: false };
    }
    throw publishCreateError("submit_button_not_found", "submit_or_save", "头条号无发布按钮");
  },

  verifySuccess(task, { urlBefore }) {
    return publishVerifyPublished(urlBefore) || (publishVerifyDraftSaved() ? window.location.href : null);
  },
};
