chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "publish") {
    publishArticle(message.task).then(sendResponse);
    return true;
  }
  if (message.action === "checkLogin") {
    const isLogin = Boolean(document.querySelector(".weui-desktop-account__nickname") || document.querySelector("#header_account"));
    sendResponse({ isLogin });
  }
});

reportPlatformLogin(
  "wechat",
  Boolean(document.querySelector(".weui-desktop-account__nickname") || document.querySelector("#header_account")),
);
