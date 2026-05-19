const BUILD_TAG = "bg-v4-direct-inject";
console.log(`[启动] background.js 已加载 tag=${BUILD_TAG} time=${new Date().toISOString()}`);

const PLATFORM_URLS = {
  zhihu: "https://www.zhihu.com/creator/writing/article/publish",
  toutiao: "https://mp.toutiao.com/profile_v4/graphic/publish",
  sohu: "https://mp.sohu.com/mpfe/v3/submit",
  baijiahao: "https://baijiahao.baidu.com/builder/rc/edit?type=news",
  wechat: "https://mp.weixin.qq.com/cgi-bin/appmsg?action=edit&type=10",
};

chrome.alarms.create("pollTasks", { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== "pollTasks") return;

  const { apiKey, serverUrl } = await chrome.storage.sync.get(["apiKey", "serverUrl"]);
  if (!apiKey || !serverUrl) return;

  try {
    const input = encodeURIComponent(JSON.stringify({ json: { apiKey } }));
    const res = await fetch(`${serverUrl.replace(/\/$/, "")}/api/trpc/publishTasks.pending?input=${input}`);
    const data = await res.json();
    const tasks = data?.result?.data?.json?.tasks || [];

    for (const task of tasks) {
      await processTask(task, apiKey, serverUrl.replace(/\/$/, ""));
    }
  } catch (e) {
    console.error("轮询失败", e);
  }
});

async function processTask(task, apiKey, serverUrl) {
  const url = PLATFORM_URLS[task.platform];
  if (!url) return;

  await updateTaskStatus(serverUrl, apiKey, task.id, "processing");

  const tab = await chrome.tabs.create({ url, active: false });

  await new Promise(resolve => setTimeout(resolve, 4000));

  try {
    const result = await chrome.tabs.sendMessage(tab.id, {
      action: "publish",
      task,
    });

    if (result?.success) {
      await updateTaskStatus(serverUrl, apiKey, task.id, "completed", result.url);
    } else {
      await updateTaskStatus(serverUrl, apiKey, task.id, "failed", null, result?.error || "发布失败");
    }
  } catch (e) {
    await updateTaskStatus(serverUrl, apiKey, task.id, "failed", null, e instanceof Error ? e.message : String(e));
  } finally {
    setTimeout(() => {
      chrome.tabs.remove(tab.id).catch(() => undefined);
    }, 5000);
  }
}

async function updateTaskStatus(serverUrl, apiKey, taskId, status, resultUrl, errorMessage) {
  await fetch(`${serverUrl}/api/trpc/publishTasks.complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      json: {
        apiKey,
        taskId,
        status,
        resultUrl: resultUrl || undefined,
        errorMessage: errorMessage || undefined,
      },
    }),
  });
}

/** tabId -> platform，连接平台后持续轮询直到检测到登录 */
const watchingTabs = new Map();

/** 各平台的登录检测函数 - 直接注入到页面执行 */
function checkZhihu() {
  return !!document.querySelector('[class*="Avatar"]') || document.cookie.includes('z_c0');
}
function checkToutiao() {
  return document.cookie.includes('sessionid') || !!document.querySelector('.user-info') || !!document.querySelector('[class*="user"]');
}
function checkSohu() {
  return document.cookie.includes('SUV') || !!document.querySelector('.user-avatar') || !!document.querySelector('[class*="avatar"]');
}
function checkBaijiahao() {
  return document.cookie.includes('BDUSS') || !!document.querySelector('.user-info') || !!document.querySelector('[class*="avatar"]');
}
function checkWechat() {
  return !!document.querySelector('#a_nickname') || document.title.includes('公众');
}

const LOGIN_CHECK_FUNCS = {
  zhihu: checkZhihu,
  toutiao: checkToutiao,
  sohu: checkSohu,
  baijiahao: checkBaijiahao,
  wechat: checkWechat,
};

async function markPlatformConnected(platform) {
  const { platformStatus } = await chrome.storage.local.get(["platformStatus"]);
  const status = platformStatus || {};
  status[platform] = true;
  await chrome.storage.local.set({ platformStatus: status });
  chrome.runtime.sendMessage({ action: "platformConnected", platform }).catch(() => {});
}

async function pollWatchingTabs() {
  if (watchingTabs.size === 0) return;

  for (const [tabId, platform] of watchingTabs.entries()) {
    try {
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab) {
        console.log(`[检测] ${platform} tabId=${tabId} tab已关闭，停止监听`);
        watchingTabs.delete(tabId);
        continue;
      }

      const checkFunc = LOGIN_CHECK_FUNCS[platform];
      if (!checkFunc) {
        console.warn(`[检测] 未知平台 ${platform}，停止监听 tabId=${tabId}`);
        watchingTabs.delete(tabId);
        continue;
      }

      console.log(`[检测] ${platform} tabId=${tabId} url=${tab.url ?? "(无)"} 开始执行脚本`);

      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: checkFunc,
        world: "MAIN",
      });

      const isLoggedIn = result?.[0]?.result;
      console.log(`[检测] ${platform} tabId=${tabId} isLoggedIn=`, isLoggedIn);

      if (isLoggedIn) {
        console.log(`[检测] ${platform} tabId=${tabId} 登录成功，更新连接状态`);
        await markPlatformConnected(platform);
        watchingTabs.delete(tabId);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[检测] ${platform} tabId=${tabId} 执行脚本失败:`, message);
    }
  }
}

setInterval(pollWatchingTabs, 5000);

// === 通信方式 1: sendMessage（popup 直接发送） ===
chrome.runtime.onMessage.addListener(message => {
  if (message.action === "watchTab" && message.tabId != null && message.platform) {
    console.log(`[监听] 收到 sendMessage: tabId=${message.tabId} platform=${message.platform}`);
    watchingTabs.set(message.tabId, message.platform);
    void pollWatchingTabs();
  }
});

// === 通信方式 2: storage 变化监听（备用，解决 MV3 Service Worker 休眠问题） ===
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.watchRequest) {
    const req = changes.watchRequest.newValue;
    if (req && req.tabId != null && req.platform) {
      console.log(`[监听] 收到 storage 变化: tabId=${req.tabId} platform=${req.platform}`);
      watchingTabs.set(req.tabId, req.platform);
      void pollWatchingTabs();
      // 清除请求，避免重复触发
      chrome.storage.local.remove("watchRequest");
    }
  }
});
