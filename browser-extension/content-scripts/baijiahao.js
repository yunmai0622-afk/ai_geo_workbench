chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "publish") {
    publishArticle(message.task).then(sendResponse);
    return true;
  }
  if (message.action === "checkLogin") {
    const isLogin = Boolean(document.querySelector(".user-name") || document.querySelector('[class*="author"]'));
    sendResponse({ isLogin });
  }
});

reportPlatformLogin("baijiahao", Boolean(document.querySelector(".user-name") || document.querySelector('[class*="login"]')));
