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

  const { apiKey, serverUrl } = await chrome.storage.local.get(["apiKey", "serverUrl"]);
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

const PLATFORM_CHECKS = {
  zhihu: {
    match: "zhihu.com",
    checkScript: `document.cookie.includes('z_c0') || !!document.querySelector('.AppHeader-userInfo')`,
  },
  toutiao: {
    match: "mp.toutiao.com",
    checkScript: `!!document.querySelector('.user-info') || document.cookie.includes('sessionid')`,
  },
  sohu: {
    match: "mp.sohu.com",
    checkScript: `!!document.querySelector('.user-avatar') || document.cookie.includes('SUV')`,
  },
  baijiahao: {
    match: "baijiahao.baidu.com",
    checkScript: `!!document.querySelector('.user-info') || document.cookie.includes('BDUSS')`,
  },
  wechat: {
    match: "mp.weixin.qq.com",
    checkScript: `!!document.querySelector('#a_nickname') || document.title.includes('公众')`,
  },
};

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;

  for (const [platform, config] of Object.entries(PLATFORM_CHECKS)) {
    if (!tab.url.includes(config.match)) continue;

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: checkPlatformLogin,
        args: [config.checkScript],
      });

      const isLoggedIn = result?.[0]?.result;
      if (!isLoggedIn) continue;

      const { platformStatus } = await chrome.storage.local.get(["platformStatus"]);
      const status = platformStatus || {};
      status[platform] = true;
      await chrome.storage.local.set({ platformStatus: status });

      chrome.runtime
        .sendMessage({
          action: "platformConnected",
          platform,
        })
        .catch(() => {});
    } catch {
      // 页面可能拒绝脚本注入，忽略
    }
  }
});
