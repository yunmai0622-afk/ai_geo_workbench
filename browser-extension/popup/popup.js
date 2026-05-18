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
  hint.textContent = `已打开${platformLabel}，请在页面完成登录；登录后插件会自动检测并显示「已连接」。`;
  hint.style.display = "block";
}

document.addEventListener("DOMContentLoaded", async () => {
  const { serverUrl, apiKey, platformStatus } = await chrome.storage.local.get(["serverUrl", "apiKey", "platformStatus"]);

  if (serverUrl) document.getElementById("serverUrl").value = serverUrl;
  if (apiKey) document.getElementById("apiKey").value = apiKey;

  applyPlatformStatus(platformStatus);

  document.querySelectorAll(".connect-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-url");
      const platform = btn.getAttribute("data-platform");
      const label = btn.getAttribute("data-label") || platform || "平台";
      if (url) chrome.tabs.create({ url, active: true });
      showConnectHint(label);
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
  await chrome.storage.local.set({ serverUrl, apiKey });
  const saveBtn = document.getElementById("saveBtn");
  saveBtn.textContent = "已保存 ✓";
  setTimeout(() => {
    saveBtn.textContent = "保存设置";
  }, 2000);
});
