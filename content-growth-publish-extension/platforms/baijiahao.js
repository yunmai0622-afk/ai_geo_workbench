window.PlatformAdapters.baijiahao = {
  platform: "baijiahao",
  publishUrl: "https://baijiahao.baidu.com/builder/rc/edit?type=news",

  async waitPageReady(task) {
    if (!window.location.hostname.includes("baijiahao.baidu.com")) {
      throw publishCreateError("publish_page_not_found", "wait_page_ready", "非百家号编辑页");
    }
    await publishSleep(1500);
    if (publishDetectLoginRequired()) {
      throw publishCreateError("login_required", "wait_page_ready", "百家号未登录");
    }
  },

  async waitEditorReady(task) {
    await publishWaitForSelector(
      [
        'textarea[placeholder*="标题"]',
        'input[placeholder*="标题"]',
        "#title-textarea",
        ".cheetah-input input",
        ".article-title input",
      ],
      25000,
      "wait_editor_ready",
      task,
    );
    await publishWaitForSelector(
      [
        ".ProseMirror",
        '[contenteditable="true"]',
        ".editor-content",
        "#editor",
        ".public-DraftEditor-content",
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
        'input[placeholder*="标题"]',
        "#title-textarea",
        ".cheetah-input input",
        ".article-title textarea",
        ".article-title input",
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
      await publishFillContentEditable(
        [".ProseMirror", ".editor-content", '[contenteditable="true"]', ".public-DraftEditor-content"],
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
        'input[type="file"]',
        ".cover-upload input",
        '[class*="cover"] input[type="file"]',
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
    throw publishCreateError("submit_button_not_found", "submit_or_save", "百家号无发布按钮");
  },

  verifySuccess(task, { urlBefore }) {
    return publishVerifyPublished(urlBefore) || (publishVerifyDraftSaved() ? window.location.href : null);
  },
};
