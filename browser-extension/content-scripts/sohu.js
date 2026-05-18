chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "publish") {
    publishArticle(message.task).then(sendResponse);
    return true;
  }
  if (message.action === "checkLogin") {
    const isLogin = Boolean(document.querySelector(".user-info") || document.querySelector('[class*="userName"]'));
    sendResponse({ isLogin });
  }
});

reportPlatformLogin("sohu", Boolean(document.querySelector(".user-info") || document.querySelector('[class*="user"]')));
