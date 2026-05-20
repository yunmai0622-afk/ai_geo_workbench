chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "publish") {
    console.log("[zhihu.js] 收到 publish 消息，开始执行发布");
    publishArticle(message.task).then(sendResponse);
    return true;
  }
  if (message.action === "checkLogin") {
    const isLogin = checkZhihuLogin();
    console.log(`[zhihu.js] checkLogin: ${isLogin}`);
    sendResponse({ isLogin });
  }
});

function checkZhihuLogin() {
  // 知乎登录检测：检查 cookie 中的 z_c0 或页面上的用户头像
  return Boolean(
    document.querySelector('[class*="Avatar"]') ||
    document.querySelector('[class*="avatar"]') ||
    document.querySelector('.GlobalWrite-navItem') ||
    document.cookie.includes("z_c0")
  );
}

const isLogin = checkZhihuLogin();
console.log(`[zhihu.js] 页面加载完成 url=${window.location.href} isLogin=${isLogin}`);
reportPlatformLogin("zhihu", isLogin);
