/**
 * Web App ↔ Extension 消息桥（仅转发，不做业务逻辑）
 */
const TRUSTED_ORIGIN_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/.*\.manus\.space$/,
  /^https:\/\/geo\.jixingzhijian\.com$/,
];

function isTrustedOrigin(origin) {
  return origin === window.location.origin || TRUSTED_ORIGIN_PATTERNS.some(re => re.test(origin));
}

window.addEventListener("message", event => {
  if (!isTrustedOrigin(event.origin)) return;
  if (!event.data || event.data.type !== "GEO_START_AUTH") return;

  const { platform, requestId } = event.data;
  if (!platform || !requestId) return;

  chrome.runtime.sendMessage(
    { action: "startAuthDetect", platform, requestId, sourceTabUrl: window.location.href },
    () => {
      if (chrome.runtime.lastError) {
        window.postMessage(
          {
            type: "GEO_AUTH_RESULT",
            platform,
            requestId,
            success: false,
            accountName: null,
            error: "插件未响应，请确认插件已安装并启用",
          },
          window.location.origin,
        );
      }
    },
  );
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== "authDetectResult") return;

  window.postMessage(
    {
      type: "GEO_AUTH_RESULT",
      platform: message.platform,
      requestId: message.requestId,
      success: Boolean(message.success),
      accountName: message.accountName ?? null,
      error: message.error ?? null,
    },
    window.location.origin,
  );
  sendResponse({ ok: true });
  return true;
});
