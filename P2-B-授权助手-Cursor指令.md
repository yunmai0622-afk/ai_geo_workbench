# P2-B：一键授权账号检测 — Cursor 增量改造指令

> **约束**：只改 Chrome Extension 和前端 UI，不改数据库 schema，不改 tRPC router。

---

## 原理说明（Cursor 需理解后再动代码）

**集星云推的「授权助手」**：App 打开一个浏览器窗口 → 用户登录 → App 抓取登录账号昵称 → 自动填入系统。

**我们的实现**：不需要独立 App。Chrome Extension 的 `content-scripts/accountDetect.js` 已经能从任何平台页面读取当前登录的账号昵称。唯一缺的是**一条把读取结果传回 Web 页面的桥**。

**通信架构**（标准 Chrome Extension MV3 内容脚本桥接模式）：

```
Web Page
  ↕ window.postMessage
Content Script (authBridge.js，注入到 Web App URL)
  ↕ chrome.runtime.sendMessage
Background Service Worker (background.js)
  ↕ chrome.tabs.sendMessage
accountDetect.js (注入到目标平台页面)
```

**完整流程**：
1. 用户在 Web 页面点击「一键授权检测」
2. Web 页面发 `window.postMessage({ type: 'GEO_START_AUTH', platform: 'toutiao' })`
3. `authBridge.js`（注入在当前 Web App 页上）收到，转发给 `background.js`
4. `background.js` 打开新 Tab 到该平台首页，等待登录检测，检测到后执行 `detectAccount`
5. `background.js` 把 `{ platform, accountName }` 发回给 `authBridge.js`
6. `authBridge.js` 通过 `window.postMessage` 回传给 Web 页面
7. Web 页面收到，自动填入「账号昵称」输入框，用户确认后保存

---

## STEP 1：新建 content-scripts/authBridge.js

**新建文件：`content-growth-publish-extension/content-scripts/authBridge.js`**

```javascript
/**
 * authBridge.js
 * 注入到 Web App 页面，作为 Web Page ↔ Chrome Extension 的双向桥梁。
 * 只负责消息转发，不做任何业务逻辑。
 */

const GEO_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Web Page → Extension：转发授权请求给 background
window.addEventListener("message", event => {
  // 只接受来自同源或已知 Web App 域名的消息
  const isTrustedOrigin =
    event.origin === window.location.origin ||
    GEO_ORIGIN_PATTERN.test(event.origin);

  if (!isTrustedOrigin) return;
  if (!event.data || event.data.type !== "GEO_START_AUTH") return;

  const { platform, requestId } = event.data;
  if (!platform) return;

  console.log(`[authBridge] 收到授权请求 platform=${platform} requestId=${requestId}`);

  chrome.runtime.sendMessage(
    { action: "startAuthDetect", platform, requestId },
    response => {
      if (chrome.runtime.lastError) {
        console.warn("[authBridge] runtime.sendMessage 失败:", chrome.runtime.lastError.message);
        // 通知页面：插件未响应
        window.postMessage(
          { type: "GEO_AUTH_RESULT", platform, requestId, success: false, error: "插件未响应，请确认插件已安装并启用" },
          "*",
        );
      }
      // 成功的回调在 background 里通过 sendMessage 回发，见下方
    },
  );
});

// Extension → Web Page：转发授权结果给页面
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "authDetectResult") {
    console.log(`[authBridge] 收到检测结果 platform=${message.platform} accountName=${message.accountName}`);
    window.postMessage(
      {
        type: "GEO_AUTH_RESULT",
        platform: message.platform,
        requestId: message.requestId,
        success: message.success,
        accountName: message.accountName ?? null,
        error: message.error ?? null,
      },
      "*",
    );
    sendResponse({ ok: true });
  }
});
```

---

## STEP 2：修改 background.js — 新增 startAuthDetect 处理逻辑

**操作文件：`content-growth-publish-extension/background.js`**

在文件末尾的 `chrome.runtime.onMessage.addListener` 块内（约第 473 行附近），在现有的 `if (message.action === "fetchCoverImage" ...)` 之前插入新的分支：

```javascript
// ── 授权助手：一键检测账号昵称 ──
if (message.action === "startAuthDetect" && message.platform) {
  const { platform, requestId } = message;
  console.log(`[授权助手] 开始检测 platform=${platform} requestId=${requestId}`);

  // 获取目标平台首页 URL（用首页更容易看到登录状态）
  const AUTH_HOME_URLS = {
    zhihu: "https://www.zhihu.com",
    toutiao: "https://mp.toutiao.com/profile_v4/index",
    sohu: "https://mp.sohu.com",
    baijiahao: "https://baijiahao.baidu.com",
    wechat: "https://mp.weixin.qq.com",
  };

  const url = AUTH_HOME_URLS[platform];
  if (!url) {
    sendResponse({ ok: false, error: `未知平台: ${platform}` });
    return true;
  }

  (async () => {
    let tab;
    try {
      // 1. 打开平台首页
      tab = await chrome.tabs.create({ url, active: true });
      console.log(`[授权助手] 已打开 tab id=${tab.id} platform=${platform}`);

      // 2. 等待页面加载完成
      await waitForTabComplete(tab.id, 30000);
      console.log(`[授权助手] 页面加载完成，等待 3 秒让 DOM 稳定...`);
      await new Promise(r => setTimeout(r, 3000));

      // 3. 尝试检测登录账号昵称
      let detectedAccountName = null;
      let attemptCount = 0;
      const maxAttempts = 10; // 最多等 30 秒（每 3 秒一次）

      while (attemptCount < maxAttempts) {
        attemptCount++;
        try {
          const detectResp = await sendMessageWithRetry(
            tab.id,
            { action: "detectAccount", platform },
            2,
            1500,
          );
          const name = detectResp?.detectedAccountName ?? null;
          if (name && name.trim().length >= 2) {
            detectedAccountName = name.trim();
            console.log(`[授权助手] 检测到账号: ${detectedAccountName}`);
            break;
          }
        } catch (e) {
          console.warn(`[授权助手] 第 ${attemptCount} 次检测失败:`, e.message);
        }

        if (attemptCount < maxAttempts) {
          console.log(`[授权助手] 第 ${attemptCount} 次未检测到，3 秒后重试...`);
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      // 4. 将结果发回给 authBridge（广播到所有 Web App Tab）
      const result = {
        action: "authDetectResult",
        platform,
        requestId,
        success: Boolean(detectedAccountName),
        accountName: detectedAccountName,
        error: detectedAccountName ? null : "未能检测到账号昵称，请确认已登录该平台",
      };

      // 找到所有 Web App Tab 并发送结果
      const allTabs = await chrome.tabs.query({});
      for (const t of allTabs) {
        if (t.id && t.url && !t.url.startsWith("chrome")) {
          try {
            await chrome.tabs.sendMessage(t.id, result);
          } catch (_) {
            // 忽略：大多数 Tab 没有注入 authBridge，sendMessage 会失败，属正常
          }
        }
      }

    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[授权助手] 检测失败:`, errMsg);

      // 发送失败结果
      const allTabs = await chrome.tabs.query({});
      for (const t of allTabs) {
        if (t.id && t.url && !t.url.startsWith("chrome")) {
          try {
            await chrome.tabs.sendMessage(t.id, {
              action: "authDetectResult",
              platform,
              requestId,
              success: false,
              accountName: null,
              error: `检测失败: ${errMsg}`,
            });
          } catch (_) {}
        }
      }
    } finally {
      // 延迟 5 秒后关闭授权 Tab（给用户看到状态的时间）
      if (tab && tab.id) {
        setTimeout(() => {
          chrome.tabs.remove(tab.id).catch(() => {});
        }, 5000);
      }
    }
  })();

  sendResponse({ ok: true, started: true });
  return true;
}
```

---

## STEP 3：修改 manifest.json — 注入 authBridge 到 Web App

**操作文件：`content-growth-publish-extension/manifest.json`**

在 `content_scripts` 数组**最后**追加一个新条目（在最后一个 `}` 之前，与现有条目用逗号分隔）：

```json
{
  "matches": [
    "http://localhost/*",
    "http://127.0.0.1/*",
    "https://*.manus.space/*",
    "https://YOUR_PRODUCTION_DOMAIN/*"
  ],
  "js": ["content-scripts/authBridge.js"],
  "run_at": "document_idle"
}
```

> **重要**：将 `https://YOUR_PRODUCTION_DOMAIN/*` 替换为实际生产域名（如 `https://app.yourdomain.com/*`）。本地开发用 `localhost` 的条目已包含。

---

## STEP 4：修改 PlatformAccountBindingSection.tsx — 添加「一键授权」按钮

**操作文件：`client/src/components/PlatformAccountBindingSection.tsx`**

在 P2 指令已经重写的版本基础上，在组件内添加授权助手逻辑。

### 4-A 添加状态变量（在已有 `const [dialogOpen, setDialogOpen]` 附近）

```tsx
// 授权助手状态
const [authingPlatform, setAuthingPlatform] = useState<BindingPublishPlatform | null>(null);
const [authError, setAuthError] = useState<string | null>(null);
```

### 4-B 添加 useEffect 监听插件回调（在组件 return 之前）

```tsx
useEffect(() => {
  const handleExtMessage = (event: MessageEvent) => {
    if (event.data?.type !== "GEO_AUTH_RESULT") return;

    const { platform, success, accountName, error } = event.data as {
      type: string;
      platform: string;
      success: boolean;
      accountName: string | null;
      error: string | null;
    };

    setAuthingPlatform(null);

    if (success && accountName) {
      // 自动打开「添加账号」弹窗并填入检测到的昵称
      setAuthError(null);
      setDialogPlatform(platform as BindingPublishPlatform);
      setEditingId(null);
      setForm({ ...emptyForm, accountName, isEnabled: true });
      setDialogOpen(true);
      toast.success(`已检测到账号「${accountName}」，请确认后保存`);
    } else {
      setAuthError(error ?? "检测失败，请手动填写账号昵称");
      toast.error(error ?? "账号检测失败");
    }
  };

  window.addEventListener("message", handleExtMessage);
  return () => window.removeEventListener("message", handleExtMessage);
}, []);  // eslint-disable-line react-hooks/exhaustive-deps
```

### 4-C 添加 handleStartAuth 函数（在 handleSave 函数附近）

```tsx
const handleStartAuth = (platform: BindingPublishPlatform) => {
  setAuthingPlatform(platform);
  setAuthError(null);

  // 发消息给 authBridge.js（Chrome Extension 内容脚本）
  window.postMessage(
    {
      type: "GEO_START_AUTH",
      platform,
      requestId: `${platform}-${Date.now()}`,
    },
    "*",
  );

  // 超时保护：30 秒无响应则取消等待状态
  setTimeout(() => {
    setAuthingPlatform(prev => (prev === platform ? null : prev));
  }, 60000);
};
```

### 4-D 在平台卡片的「添加账号」按钮旁边，补充「一键授权」按钮

找到现有的「添加账号」按钮：

```tsx
<Button
  type="button"
  size="sm"
  className={aiPrimaryBtn}
  onClick={() => openAddDialog(platform)}
>
  <Plus className="mr-1 h-3.5 w-3.5" />
  添加账号
</Button>
```

替换为：

```tsx
<div className="flex items-center gap-2">
  <Button
    type="button"
    size="sm"
    className={aiPrimaryBtn}
    onClick={() => openAddDialog(platform)}
  >
    <Plus className="mr-1 h-3.5 w-3.5" />
    手动添加
  </Button>
  <Button
    type="button"
    size="sm"
    variant="outline"
    className={cn(
      aiOutlineBtn,
      authingPlatform === platform && "cursor-wait opacity-60",
    )}
    disabled={authingPlatform !== null}
    onClick={() => handleStartAuth(platform)}
    title="自动打开平台页面，检测当前登录账号昵称"
  >
    {authingPlatform === platform ? (
      <>
        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        检测中…
      </>
    ) : (
      <>
        <Zap className="mr-1 h-3.5 w-3.5" />
        一键授权
      </>
    )}
  </Button>
</div>
```

### 4-E 添加缺少的 lucide-react import

在现有的 `import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react"` 中补充 `Loader2, Zap`：

```tsx
import { Loader2, Pencil, Plus, Trash2, ToggleLeft, ToggleRight, Zap } from "lucide-react";
```

### 4-F 在平台卡片错误提示区域（accounts 列表下方）加错误提示

```tsx
{authError && authingPlatform === null && (
  <p className="text-xs text-red-400">{authError}</p>
)}
```

---

## STEP 5：验证 Extension 是否已有 accountDetect 注入在所有平台

检查 `manifest.json`——所有平台的 `content_scripts` 条目都应包含 `"content-scripts/accountDetect.js"`。

当前 wechat 的条目缺少 `accountDetect.js`：

```json
{
  "matches": ["https://mp.weixin.qq.com/*"],
  "js": ["content-scripts/shared.js", "content-scripts/wechat.js"],
  "run_at": "document_idle"
}
```

补充为：

```json
{
  "matches": ["https://mp.weixin.qq.com/*"],
  "js": ["content-scripts/accountDetect.js", "content-scripts/shared.js", "content-scripts/wechat.js"],
  "run_at": "document_idle"
}
```

同时，在 `content-scripts/accountDetect.js` 的 `detectAccountNameForPlatform` 函数中，补充微信公众号的检测逻辑：

```javascript
function detectWechatAccountName() {
  const selectors = [
    "#a_nickname",           // 公众号昵称（已知选择器）
    ".account_nickname_inner",
    '[class*="nickname"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = pickAccountText(el);
    if (text) return text;
  }
  return null;
}

// 在 switch 中添加：
case "wechat":
  return detectWechatAccountName();
```

---

## STEP 6：重新打包 Extension

修改完所有文件后，需要重新打包并在 Chrome 中重新加载插件：

```bash
# 在 content-growth-publish-extension/ 目录下打包
cd content-growth-publish-extension
zip -r ../client/public/browser-extension.zip . -x "*.DS_Store"
```

然后在 Chrome `chrome://extensions/` → 加载已解压的扩展程序（开发时）或重新安装打包版（生产时）。

---

## 整体用户体验

| 步骤 | 用户操作 |
|------|---------|
| 1 | 在「平台账号绑定」区域，点击「一键授权」（闪电图标）按钮 |
| 2 | 按钮变为「检测中…」旋转状态，自动弹出新 Tab 到对应平台 |
| 3 | 若已登录：3~10 秒内自动关闭新 Tab，弹出「添加账号」弹窗，昵称已自动填入 |
| 4 | 若未登录：新 Tab 等待用户登录，登录成功后自动检测（最多等 30 秒） |
| 5 | 用户确认昵称无误，点「保存」完成绑定 |
| 6 | 若 60 秒超时无响应：取消等待状态，提示手动添加 |

---

## 文件变更总览

| 文件 | 操作 |
|------|------|
| `content-growth-publish-extension/content-scripts/authBridge.js` | **新建** |
| `content-growth-publish-extension/background.js` | 增量：新增 `startAuthDetect` message handler |
| `content-growth-publish-extension/manifest.json` | 增量：authBridge 注入规则 + wechat 补 accountDetect |
| `content-growth-publish-extension/content-scripts/accountDetect.js` | 增量：补充 wechat 检测逻辑 |
| `client/src/components/PlatformAccountBindingSection.tsx` | 增量：授权助手状态 + useEffect + handleStartAuth + 一键授权按钮 |
| `client/public/browser-extension.zip` | 重新打包 |

**不涉及数据库变更，不涉及 tRPC router 变更。**
