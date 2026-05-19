const BUILD_TAG = "bg-v3-sync-credentials";
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

/** 在页面上下文中执行登录检测表达式（由 background 注入） */
function checkPlatformLogin(checkScript) {
  try {
    // eslint-disable-next-line no-eval
    return Boolean(eval(checkScript));
  } catch {
    return false;
  }
}

/** tabId -> platform，连接平台后持续轮询直到检测到登录 */
const watchingTabs = new Map();

const LOGIN_CHECKS = {
  zhihu: `!!document.querySelector('[class*="Avatar"]') || document.cookie.includes('z_c0')`,
  toutiao: `document.cookie.includes('sessionid') || !!document.querySelector('.user-info')`,
  sohu: `document.cookie.includes('SUV') || !!document.querySelector('.user-avatar')`,
  baijiahao: `document.cookie.includes('BDUSS') || !!document.querySelector('.user-info')`,
  wechat: `!!document.querySelector('#a_nickname') || document.title.includes('公众')`,
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

      const checkScript = LOGIN_CHECKS[platform];
      if (!checkScript) {
        console.warn(`[检测] 未知平台 ${platform}，停止监听 tabId=${tabId}`);
        watchingTabs.delete(tabId);
        continue;
      }

      console.log(`[检测] ${platform} tabId=${tabId} url=${tab.url ?? "(无)"} 开始执行脚本`);

      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: checkPlatformLogin,
        args: [checkScript],
      });

      console.log(`[检测] ${platform} tabId=${tabId} result=`, result);

      const isLoggedIn = result?.[0]?.result;
      console.log(`[检测] ${platform} tabId=${tabId} isLoggedIn=`, isLoggedIn);

      if (isLoggedIn) {
        console.log(`[检测] ${platform} tabId=${tabId} 登录成功，更新连接状态`);
        await markPlatformConnected(platform);
        watchingTabs.delete(tabId);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[检测] ${platform} tabId=${tabId} 执行脚本失败:`, message, e);
    }
  }
}

setInterval(pollWatchingTabs, 5000);

chrome.runtime.onMessage.addListener(message => {
  if (message.action === "watchTab" && message.tabId != null && message.platform) {
    console.log(`[监听] 开始监听 tabId=${message.tabId} platform=${message.platform}`);
    watchingTabs.set(message.tabId, message.platform);
    void pollWatchingTabs();
  }
});
