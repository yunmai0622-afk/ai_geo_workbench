const PLATFORM_LABELS = {
  zhihu: "知乎",
  toutiao: "头条号",
  sohu: "搜狐号",
  baijiahao: "百家号",
  wechat: "微信公众号",
};

function applyPlatformStatus(platformStatus) {
  if (!platformStatus) return;
  Object.entries(platformStatus).forEach(([platform, connected]) => {
    const el = document.getElementById(`${platform}-status`);
    if (el) {
      el.textContent = connected ? "已连接" : "未连接";
      el.className = `status ${connected ? "connected" : "disconnected"}`;
    }
  });
}

function showConnectHint(platformLabel) {
  const hint = document.getElementById("connectHint");
  if (!hint) return;
  hint.textContent = `请在打开的${platformLabel}页面完成登录，插件会自动检测并显示「已连接」。`;
  hint.style.display = "block";
}

async function connectPlatform(platform, url, label) {
  const tab = await chrome.tabs.create({ url, active: true });
  if (tab.id != null) {
    chrome.runtime
      .sendMessage({
        action: "watchTab",
        tabId: tab.id,
        platform,
      })
      .catch(() => {});
  }
  showConnectHint(label || PLATFORM_LABELS[platform] || platform);
}

document.addEventListener("DOMContentLoaded", async () => {
  const [{ serverUrl, apiKey }, { platformStatus }] = await Promise.all([
    chrome.storage.sync.get(["serverUrl", "apiKey"]),
    chrome.storage.local.get(["platformStatus"]),
  ]);

  if (serverUrl) document.getElementById("serverUrl").value = serverUrl;
  if (apiKey) document.getElementById("apiKey").value = apiKey;

  applyPlatformStatus(platformStatus);

  document.querySelectorAll(".connect-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-url");
      const platform = btn.getAttribute("data-platform");
      const label = btn.getAttribute("data-label") || PLATFORM_LABELS[platform] || platform || "平台";
      if (url && platform) void connectPlatform(platform, url, label);
    });
  });

  document.getElementById("checkBtn")?.addEventListener("click", async () => {
    const { platformStatus: latest } = await chrome.storage.local.get(["platformStatus"]);
    applyPlatformStatus(latest);
    const checkBtn = document.getElementById("checkBtn");
    if (checkBtn) {
      const prev = checkBtn.textContent;
      checkBtn.textContent = "已刷新 ✓";
      setTimeout(() => {
        checkBtn.textContent = prev;
      }, 1500);
    }
  });
});

chrome.runtime.onMessage.addListener(message => {
  if (message.action === "platformConnected") {
    const el = document.getElementById(`${message.platform}-status`);
    if (el) {
      el.textContent = "已连接";
      el.className = "status connected";
    }
  }
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  const serverUrl = document.getElementById("serverUrl").value.trim();
  const apiKey = document.getElementById("apiKey").value.trim();
  await chrome.storage.sync.set({ serverUrl, apiKey });
  const saveBtn = document.getElementById("saveBtn");
  saveBtn.textContent = "已保存 ✓";
  setTimeout(() => {
    saveBtn.textContent = "保存设置";
  }, 2000);
});
