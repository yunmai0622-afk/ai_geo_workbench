window.PlatformAdapters.zhihu = {
  platform: "zhihu",
  publishUrl: "https://zhuanlan.zhihu.com/write",

  async waitPageReady(task) {
    if (!window.location.hostname.includes("zhihu.com")) {
      throw publishCreateError("publish_page_not_found", "wait_page_ready", "非知乎发布页");
    }
    await publishSleep(1000);
    publishLog(task, "wait_page_ready", { result: "ok" });
  },

  async waitEditorReady(task) {
    await publishWaitForSelector(
      [".public-DraftEditor-content", ".DraftEditor-root"],
      20000,
      "wait_editor_ready",
      task,
    );
  },

  async fillTitle(task) {
    const { el } = await publishWaitForSelector(
      ['textarea[placeholder*="标题"]', "textarea.Input", "textarea"],
      15000,
      "fill_title",
      task,
    );
    publishSetNativeValue(el, task.articleTitle ?? "");
    await publishSleep(500);
  },

  async fillContent(task) {
    await publishFillContentEditable(
      [".public-DraftEditor-content"],
      task.articleContent ?? "",
      task,
      "fill_content",
    );
  },

  async uploadCover(task) {
    const inputs = document.querySelectorAll("input.UploadPicture-input");
    const selector =
      inputs.length >= 2 ? "input.UploadPicture-input:nth-of-type(2)" : "input.UploadPicture-input";
    const result = await publishUploadCoverInput([selector], task, "upload_cover");
    return { ok: result.ok, required: false, error: result.error?.message };
  },

  async submitOrSave(task) {
    const start = Date.now();
    while (Date.now() - start < 15000) {
      const classBtn = document.querySelector("button.WriteIndex-publishButton:not([disabled])");
      if (classBtn && !classBtn.closest(".DraftEditor-root, .public-DraftEditor-content")) {
        classBtn.click();
        await publishSleep(5000);
        return { isDraft: false, draftSaved: false };
      }
      const btn = Array.from(document.querySelectorAll("button")).find(b => {
        if (b.closest(".DraftEditor-root, .public-DraftEditor-content")) return false;
        if (b.disabled) return false;
        const txt = b.textContent?.trim();
        if (/保存草稿|存草稿|草稿/.test(txt ?? "")) return false;
        return txt === "发布" || txt === "发布文章";
      });
      if (btn) {
        btn.click();
        await publishSleep(5000);
        return { isDraft: false, draftSaved: false };
      }
      await publishSleep(500);
    }
    const draftBtn = publishFindButton([/保存草稿/, /存草稿/]);
    if (draftBtn) {
      draftBtn.click();
      await publishSleep(4000);
      return { isDraft: true, draftSaved: true };
    }
    throw publishCreateError("submit_button_not_found", "submit_or_save", "等待发布按钮超时");
  },

  verifySuccess(task, { urlBefore }) {
    let href = window.location.href;
    href = href.replace(/\/edit\/?(\?|#|$)/, "$1").replace(/\/edit$/, "");
    if (publishVerifyPublished(urlBefore)) return href;
    if (publishVerifyDraftSaved()) return href;
    return null;
  },
};
