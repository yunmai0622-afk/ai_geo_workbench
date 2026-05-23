function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function markdownToPlainText(markdown) {
  if (!markdown) return "";
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .trim();
}

function reportPlatformLogin(platform, isLogin) {
  chrome.storage.local.get(["platformStatus"], result => {
    const status = result.platformStatus || {};
    status[platform] = Boolean(isLogin);
    chrome.storage.local.set({ platformStatus: status });
  });
}

/**
 * 各平台统一走 platforms/* 适配器流水线（C7-C）
 */
async function publishArticle(task) {
  if (typeof window.runPlatformPublish === "function") {
    return window.runPlatformPublish(task);
  }
  return {
    success: false,
    errorType: "unknown",
    step: "init",
    errorMessage: JSON.stringify({
      errorType: "unknown",
      step: "init",
      customerMessage: "发布适配器未加载，请重新加载插件后重试。",
    }),
  };
}
