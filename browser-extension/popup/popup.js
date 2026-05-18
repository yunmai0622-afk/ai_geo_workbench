document.addEventListener("DOMContentLoaded", async () => {
  const { serverUrl, apiKey, platformStatus } = await chrome.storage.local.get(["serverUrl", "apiKey", "platformStatus"]);

  if (serverUrl) document.getElementById("serverUrl").value = serverUrl;
  if (apiKey) document.getElementById("apiKey").value = apiKey;

  if (platformStatus) {
    Object.entries(platformStatus).forEach(([platform, connected]) => {
      const el = document.getElementById(`${platform}-status`);
      if (el) {
        el.textContent = connected ? "已连接" : "未连接";
        el.className = `status ${connected ? "connected" : "disconnected"}`;
      }
    });
  }

  document.querySelectorAll(".connect-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-url");
      if (url) chrome.tabs.create({ url, active: true });
    });
  });
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
