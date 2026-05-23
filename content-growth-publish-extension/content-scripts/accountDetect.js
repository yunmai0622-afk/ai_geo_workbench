/**
 * 各平台当前登录账号昵称识别（禁止 mock；识别失败返回 null）
 */

function pickAccountText(el) {
  const text = el?.textContent?.trim() ?? el?.getAttribute?.("title")?.trim() ?? "";
  if (!text || text.length < 2 || text.length > 60) return null;
  if (/登录|注册|退出|设置|消息|通知/.test(text)) return null;
  return text;
}

function detectZhihuAccountName() {
  const selectors = [
    ".AppHeader-userInfo .AppHeader-profileEntry",
    '[data-za-detail-view-element_name="User"]',
    'a[href*="/people/"]',
    ".GlobalSideBar-navLink",
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = pickAccountText(el);
    if (text) return text;
  }
  return null;
}

function detectBaijiahaoAccountName() {
  const selectors = [".user-name", ".author-name", '[class*="userName"]', '[class*="account"]'];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = pickAccountText(el);
    if (text) return text;
  }
  return null;
}

function detectToutiaoAccountName() {
  const selectors = [".user-name", ".name", '[class*="user-name"]', '[class*="username"]'];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = pickAccountText(el);
    if (text) return text;
  }
  return null;
}

function detectSohuAccountName() {
  const selectors = [".user-name", ".account-name", '[class*="user"]', '[class*="nickname"]'];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = pickAccountText(el);
    if (text) return text;
  }
  return null;
}

function detectAccountNameForPlatform(platform) {
  switch (platform) {
    case "zhihu":
      return detectZhihuAccountName();
    case "baijiahao":
      return detectBaijiahaoAccountName();
    case "toutiao":
      return detectToutiaoAccountName();
    case "sohu":
      return detectSohuAccountName();
    default:
      return null;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "detectAccount") {
    const detectedAccountName = detectAccountNameForPlatform(message.platform);
    sendResponse({ detectedAccountName });
    return true;
  }
});
