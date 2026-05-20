const BUILD_TAG = "bg-v8-zhihu-url-fix";
console.log(`[启动] background.js 已加载 tag=${BUILD_TAG} time=${new Date().toISOString()}`);

const PLATFORM_URLS = {
  zhihu: "https://zhuanlan.zhihu.com/write",
  toutiao: "https://mp.toutiao.com/profile_v4/graphic/publish",
  sohu: "https://mp.sohu.com/mpfe/v3/submit",
  baijiahao: "https://baijiahao.baidu.com/builder/rc/edit?type=news",
  wechat: "https://mp.weixin.qq.com/cgi-bin/appmsg?action=edit&type=10",
};

// ==================== 发布任务轮询 ====================

chrome.alarms.create("pollTasks", { periodInMinutes: 0.5 });
// 登录检测轮询 alarm
chrome.alarms.create("checkLogin", { delayInMinutes: 0.1, periodInMinutes: 0.1 });

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === "pollTasks") {
    await handlePollTasks();
  } else if (alarm.name === "checkLogin") {
    await processPendingWatch();
    await handleCheckLogin();
  }
});

async function handlePollTasks() {
  const { apiKey, serverUrl } = await chrome.storage.sync.get(["apiKey", "serverUrl"]);
  if (!apiKey || !serverUrl) {
    console.log("[轮询] 跳过：apiKey 或 serverUrl 未配置");
    return;
  }

  try {
    const input = encodeURIComponent(JSON.stringify({ json: { apiKey } }));
    const url = `${serverUrl.replace(/\/$/, "")}/api/trpc/publishTasks.pending?input=${input}`;
    console.log(`[轮询] 请求待发布任务: ${url}`);
    const res = await fetch(url);
    const data = await res.json();
    const tasks = data?.result?.data?.json?.tasks || [];

    console.log(`[轮询] 获取到 ${tasks.length} 个待发布任务`);

    for (const task of tasks) {
      console.log(`[轮询] 开始处理任务 id=${task.id} platform=${task.platform} title=${task.articleTitle}`);
      await processTask(task, apiKey, serverUrl.replace(/\/$/, ""));
    }
  } catch (e) {
    console.error("[轮询] 请求失败", e);
  }
}

/**
 * 等待 tab 加载完成
 */
function waitForTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error(`等待 tab ${tabId} 加载超时 (${timeoutMs}ms)`));
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    // 先检查当前状态
    chrome.tabs.get(tabId).then(tab => {
      if (tab.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      } else {
        chrome.tabs.onUpdated.addListener(listener);
      }
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * 带重试的 sendMessage
 */
async function sendMessageWithRetry(tabId, message, maxRetries = 5, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[发布] sendMessage 尝试 ${attempt}/${maxRetries} tabId=${tabId}`);
      const result = await chrome.tabs.sendMessage(tabId, message);
      return result;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.warn(`[发布] sendMessage 失败 (${attempt}/${maxRetries}): ${errMsg}`);
      if (attempt === maxRetries) {
        throw new Error(`sendMessage 在 ${maxRetries} 次重试后仍然失败: ${errMsg}`);
      }
      // 等待后重试，给 content script 更多加载时间
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

async function processTask(task, apiKey, serverUrl) {
  const url = PLATFORM_URLS[task.platform];
  if (!url) {
    console.error(`[发布] 未知平台: ${task.platform}`);
    await updateTaskStatus(serverUrl, apiKey, task.id, "failed", null, `未知平台: ${task.platform}`);
    return;
  }

  console.log(`[发布] 开始任务 id=${task.id} platform=${task.platform} 打开: ${url}`);
  await updateTaskStatus(serverUrl, apiKey, task.id, "processing");

  let tab;
  try {
    tab = await chrome.tabs.create({ url, active: true });
    console.log(`[发布] 已创建 tab id=${tab.id} 等待加载完成...`);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`[发布] 创建 tab 失败: ${errMsg}`);
    await updateTaskStatus(serverUrl, apiKey, task.id, "failed", null, `创建 tab 失败: ${errMsg}`);
    return;
  }

  try {
    // 等待页面加载完成
    await waitForTabComplete(tab.id, 30000);
    console.log(`[发布] tab ${tab.id} 加载完成，额外等待 3 秒让 content script 注入...`);

    // 额外等待让 content script 完全注入和初始化
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 带重试的消息发送
    const result = await sendMessageWithRetry(tab.id, {
      action: "publish",
      task,
    }, 5, 3000);

    console.log(`[发布] 任务 id=${task.id} 执行结果:`, JSON.stringify(result));

    if (result?.success) {
      await updateTaskStatus(serverUrl, apiKey, task.id, "completed", result.url);
      console.log(`[发布] 任务 id=${task.id} 发布成功 url=${result.url}`);
    } else {
      const errorMsg = result?.error || "发布失败（content script 返回失败）";
      await updateTaskStatus(serverUrl, apiKey, task.id, "failed", null, errorMsg);
      console.error(`[发布] 任务 id=${task.id} 发布失败: ${errorMsg}`);
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`[发布] 任务 id=${task.id} 执行异常: ${errMsg}`);
    await updateTaskStatus(serverUrl, apiKey, task.id, "failed", null, errMsg);
  } finally {
    // 延迟关闭 tab
    if (tab && tab.id) {
      setTimeout(() => {
        chrome.tabs.remove(tab.id).catch(() => undefined);
      }, 8000);
    }
  }
}

async function updateTaskStatus(serverUrl, apiKey, taskId, status, resultUrl, errorMessage) {
  try {
    const body = {
      json: {
        apiKey,
        taskId,
        status,
        resultUrl: resultUrl || undefined,
        errorMessage: errorMessage || undefined,
      },
    };
    console.log(`[发布] 更新任务状态: taskId=${taskId} status=${status}`);
    const res = await fetch(`${serverUrl}/api/trpc/publishTasks.complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[发布] 更新状态失败: HTTP ${res.status}`);
    }
  } catch (e) {
    console.error(`[发布] 更新状态异常:`, e);
  }
}

// ==================== 登录检测（持久化到 storage） ====================

/** 各平台的登录检测函数 - 直接注入到页面 MAIN world 执行 */
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

/**
 * 从 storage 读取正在监听的 tabs
 * 格式: { watchingTabs: { "tabId": "platform", ... } }
 */
async function getWatchingTabs() {
  const { watchingTabs } = await chrome.storage.local.get(["watchingTabs"]);
  return watchingTabs || {};
}

async function setWatchingTabs(tabs) {
  await chrome.storage.local.set({ watchingTabs: tabs });
}

async function addWatchingTab(tabId, platform) {
  const tabs = await getWatchingTabs();
  tabs[String(tabId)] = platform;
  await setWatchingTabs(tabs);
  console.log(`[监听] 已添加 tabId=${tabId} platform=${platform}，当前监听数: ${Object.keys(tabs).length}`);
}

async function removeWatchingTab(tabId) {
  const tabs = await getWatchingTabs();
  delete tabs[String(tabId)];
  await setWatchingTabs(tabs);
}

async function markPlatformConnected(platform) {
  const { platformStatus } = await chrome.storage.local.get(["platformStatus"]);
  const status = platformStatus || {};
  status[platform] = true;
  await chrome.storage.local.set({ platformStatus: status });
  // 尝试通知 popup（如果打开的话）
  chrome.runtime.sendMessage({ action: "platformConnected", platform }).catch(() => {});
  console.log(`[连接成功] ${platform} 已标记为已连接`);
}

/** 核心轮询函数 - 由 alarm 触发，从 storage 读取监听列表 */
async function handleCheckLogin() {
  const tabs = await getWatchingTabs();
  const tabIds = Object.keys(tabs);

  if (tabIds.length === 0) return;

  console.log(`[检测] 开始检测 ${tabIds.length} 个 tab`);

  for (const tabIdStr of tabIds) {
    const tabId = Number(tabIdStr);
    const platform = tabs[tabIdStr];

    try {
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab) {
        console.log(`[检测] ${platform} tabId=${tabId} tab已关闭，停止监听`);
        await removeWatchingTab(tabId);
        continue;
      }

      const checkFunc = LOGIN_CHECK_FUNCS[platform];
      if (!checkFunc) {
        console.warn(`[检测] 未知平台 ${platform}，停止监听 tabId=${tabId}`);
        await removeWatchingTab(tabId);
        continue;
      }

      console.log(`[检测] ${platform} tabId=${tabId} url=${tab.url ?? "(无)"}`);

      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: checkFunc,
        world: "MAIN",
      });

      const isLoggedIn = result?.[0]?.result;
      console.log(`[检测] ${platform} tabId=${tabId} isLoggedIn=${isLoggedIn}`);

      if (isLoggedIn) {
        await markPlatformConnected(platform);
        await removeWatchingTab(tabId);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[检测] ${platform} tabId=${tabId} 失败:`, message);
    }
  }
}

// ==================== 接收 popup 的连接请求 ====================

// 平台 URL 前缀映射（用于匹配 tab）
const PLATFORM_URL_PATTERNS = {
  zhihu: ["zhihu.com"],
  toutiao: ["mp.toutiao.com", "toutiao.com"],
  sohu: ["mp.sohu.com", "sohu.com"],
  baijiahao: ["baijiahao.baidu.com"],
  wechat: ["mp.weixin.qq.com"],
};

/** 处理 pendingWatch：找到匹配的 tab 并加入监听列表 */
async function processPendingWatch() {
  const { pendingWatch } = await chrome.storage.local.get(["pendingWatch"]);
  if (!pendingWatch || !pendingWatch.platform) return;

  // 超过 2 分钟的 pendingWatch 视为过期
  if (Date.now() - (pendingWatch.timestamp || 0) > 120000) {
    await chrome.storage.local.remove("pendingWatch");
    return;
  }

  const platform = pendingWatch.platform;
  const patterns = PLATFORM_URL_PATTERNS[platform] || [];

  // 查找匹配的 tab
  const allTabs = await chrome.tabs.query({});
  const matchedTab = allTabs.find(tab => {
    if (!tab.url) return false;
    return patterns.some(p => tab.url.includes(p));
  });

  if (matchedTab && matchedTab.id != null) {
    console.log(`[pendingWatch] 找到 ${platform} tab: id=${matchedTab.id} url=${matchedTab.url}`);
    await addWatchingTab(matchedTab.id, platform);
    await chrome.storage.local.remove("pendingWatch");
  } else {
    console.log(`[pendingWatch] ${platform} 暂未找到匹配的 tab，等待下次检查...`);
  }
}

// 方式 1: sendMessage（如果 popup 没被关闭的话）
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "watchTab" && message.tabId != null && message.platform) {
    console.log(`[监听] 收到 sendMessage: tabId=${message.tabId} platform=${message.platform}`);
    addWatchingTab(message.tabId, message.platform).then(() => {
      handleCheckLogin();
      sendResponse({ ok: true });
    });
    return true;
  }
});

// 方式 2: storage 变化监听
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.pendingWatch) {
    const req = changes.pendingWatch.newValue;
    if (req && req.platform) {
      console.log(`[监听] 收到 storage pendingWatch: platform=${req.platform}`);
      // 延迟 2 秒处理，等 tab 加载
      setTimeout(() => processPendingWatch(), 2000);
    }
  }
  if (areaName === "local" && changes.watchRequest) {
    const req = changes.watchRequest.newValue;
    if (req && req.tabId != null && req.platform) {
      console.log(`[监听] 收到 storage watchRequest: tabId=${req.tabId} platform=${req.platform}`);
      addWatchingTab(req.tabId, req.platform).then(() => {
        handleCheckLogin();
      });
      chrome.storage.local.remove("watchRequest");
    }
  }
});
