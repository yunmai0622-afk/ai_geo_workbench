chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "publish") {
    publishArticle(message.task).then(sendResponse);
    return true;
  }
  if (message.action === "checkLogin") {
    const isLogin = Boolean(document.querySelector('[class*="Avatar"]') || document.cookie.includes("z_c0"));
    sendResponse({ isLogin });
  }
});

reportPlatformLogin("zhihu", Boolean(document.querySelector('[class*="Avatar"]') || document.cookie.includes("z_c0")));
