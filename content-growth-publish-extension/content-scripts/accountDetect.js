/**
 * 各平台当前登录账号昵称识别（禁止 mock；识别失败返回 null）
 */

const ALT_SKIP = /^(头像|知乎|logo|默认头像|用户头像|我的头像)$/i;
const TEXT_SKIP = /登录|注册|退出|设置|消息|通知|首页|发现|搜索/;
const ZHIHU_TEXT_SKIP = /知乎|搜索|首页|消息|设置|logo|头像/i;

function logCandidate(source, selector, text) {
  console.log("[accountDetect] candidate", { source, selector, text });
}

function pickAltText(alt) {
  const text = (alt ?? "").trim();
  if (!text || text.length < 2 || text.length > 30) return null;
  if (ALT_SKIP.test(text)) return null;
  if (/^https?:\/\//i.test(text)) return null;
  if (TEXT_SKIP.test(text)) return null;
  return text;
}

function pickAccountText(el) {
  if (!el) return null;
  const alt = el.getAttribute?.("alt");
  if (alt) {
    const fromAlt = pickAltText(alt);
    if (fromAlt) return fromAlt;
  }
  const aria = el.getAttribute?.("aria-label") ?? el.getAttribute?.("title");
  if (aria) {
    const fromAria = pickAltText(aria) ?? (aria.length >= 2 && aria.length <= 60 && !TEXT_SKIP.test(aria) ? aria.trim() : null);
    if (fromAria) return fromAria;
  }
  const text = el.textContent?.trim() ?? "";
  if (!text || text.length < 2 || text.length > 60) return null;
  if (TEXT_SKIP.test(text)) return null;
  return text;
}

function isZhihuNoise(text) {
  if (!text || text.length < 2 || text.length > 30) return true;
  if (ZHIHU_TEXT_SKIP.test(text)) return true;
  if (/^https?:\/\//i.test(text)) return true;
  return false;
}

function zhihuPriority(source) {
  if (source === "img[alt]") return 1;
  if (source === 'a[href*="/people/"]' || source === 'a[href*="/org/"]') return 2;
  if (source === "title") return 3;
  if (source === "aria-label") return 4;
  return 5;
}

function tryFirstMatch(platform, selector, root = document, source = selector) {
  const el = root.querySelector(selector);
  const text = pickAccountText(el);
  if (text) {
    logCandidate(source, selector, text.trim());
    return text.trim();
  }
  return null;
}

function tryAllImgAlt(platform, scope = document) {
  for (const img of scope.querySelectorAll("img[alt]")) {
    const text = pickAltText(img.getAttribute("alt"));
    if (text) {
      logCandidate("img[alt]", "img[alt]", text);
      return text.trim();
    }
  }
  return null;
}

function collectZhihuCandidates() {
  const candidates = [];

  const imgSelectors = [
    '[data-za-detail-view-path-module="TopNavBar"] img[alt]',
    "header img[alt]",
    "img.Avatar[alt]",
    ".Avatar[alt]",
    '[class*="Avatar"] img[alt]',
    '[class*="Avatar"][alt]',
  ];
  for (const sel of imgSelectors) {
    for (const el of document.querySelectorAll(sel)) {
      const text = pickAltText(el.getAttribute("alt"));
      if (text && !isZhihuNoise(text)) {
        candidates.push({ source: "img[alt]", selector: sel, text: text.trim(), priority: 1 });
      }
    }
  }

  const scanNodes = document.querySelectorAll(
    'a[href*="/people/"], a[href*="/org/"], button, [role="button"], img[alt], [title], [aria-label]',
  );

  for (const el of scanNodes) {
    const href = el.getAttribute?.("href") ?? "";
    const tag = el.tagName?.toLowerCase() ?? "";

    if (tag === "img" && el.getAttribute("alt")) {
      const text = pickAltText(el.getAttribute("alt"));
      if (text && !isZhihuNoise(text)) {
        candidates.push({ source: "img[alt]", selector: "img[alt]", text: text.trim(), priority: 1 });
      }
      continue;
    }

    if (href.includes("/people/") || href.includes("/org/")) {
      const text = pickAccountText(el);
      if (text && !isZhihuNoise(text)) {
        const source = href.includes("/org/") ? 'a[href*="/org/"]' : 'a[href*="/people/"]';
        candidates.push({ source, selector: source, text: text.trim(), priority: 2 });
      }
      const title = el.getAttribute?.("title")?.trim();
      if (title && !isZhihuNoise(title)) {
        candidates.push({ source: "title", selector: source, text: title, priority: 3 });
      }
      continue;
    }

    const title = el.getAttribute?.("title")?.trim();
    if (title && !isZhihuNoise(title)) {
      candidates.push({ source: "title", selector: "[title]", text: title, priority: 3 });
    }

    const aria = el.getAttribute?.("aria-label")?.trim();
    if (aria && !isZhihuNoise(aria)) {
      candidates.push({ source: "aria-label", selector: "[aria-label]", text: aria, priority: 4 });
    }

    if (tag === "button" || el.getAttribute("role") === "button") {
      const text = pickAccountText(el);
      if (text && !isZhihuNoise(text)) {
        candidates.push({ source: "button", selector: "button", text: text.trim(), priority: 5 });
      }
    }
  }

  const ariaSelectors = ['[aria-label*="个人"]', '[aria-label*="账号"]', '[aria-label*="用户"]'];
  for (const sel of ariaSelectors) {
    for (const el of document.querySelectorAll(sel)) {
      const aria = el.getAttribute?.("aria-label")?.trim();
      if (aria && !isZhihuNoise(aria)) {
        candidates.push({ source: "aria-label", selector: sel, text: aria, priority: 4 });
      }
    }
  }

  const legacySelectors = [
    ".AppHeader-userInfo .AppHeader-profileEntry",
    '[data-za-detail-view-element_name="User"]',
    'a[href*="/people/"]',
    ".GlobalSideBar-navLink",
  ];
  for (const sel of legacySelectors) {
    for (const el of document.querySelectorAll(sel)) {
      const text = pickAccountText(el);
      if (text && !isZhihuNoise(text)) {
        candidates.push({ source: 'a[href*="/people/"]', selector: sel, text: text.trim(), priority: 2 });
      }
    }
  }

  return candidates;
}

function detectZhihuAccountName() {
  console.log("[accountDetect] detect zhihu start");

  const candidates = collectZhihuCandidates();
  if (candidates.length === 0) {
    const fromAlt = tryAllImgAlt("zhihu");
    if (fromAlt) return fromAlt;
    console.warn("[accountDetect] zhihu candidates empty", { href: location.href });
    return null;
  }

  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    const key = c.text;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...c, priority: zhihuPriority(c.source) });
  }

  unique.sort((a, b) => a.priority - b.priority || a.text.length - b.text.length);
  const best = unique[0];
  logCandidate(best.source, best.selector, best.text);
  if (unique.length > 1) {
    console.log("[accountDetect] zhihu candidate pool", unique.slice(0, 8).map(c => ({ source: c.source, text: c.text })));
  }
  return best.text;
}

function detectBaijiahaoAccountName() {
  console.log("[accountDetect] detect baijiahao start");
  const selectors = [
    ".user-name",
    ".author-name",
    ".account-name",
    '[class*="userName"]',
    '[class*="user"] [class*="name"]',
    '[class*="account"] [class*="name"]',
    '[class*="UserName"]',
    '[class*="accountName"]',
  ];
  for (const sel of selectors) {
    const found = tryFirstMatch("baijiahao", sel);
    if (found) return found;
  }
  return tryAllImgAlt("baijiahao") ?? null;
}

function detectToutiaoAccountName() {
  console.log("[accountDetect] detect toutiao start");
  const selectors = [
    ".user-name",
    ".name",
    '[class*="user-name"]',
    '[class*="username"]',
    '[class*="user"] [class*="name"]',
    '[class*="account"]',
    '[class*="avatar"]',
    '[class*="UserName"]',
  ];
  for (const sel of selectors) {
    const found = tryFirstMatch("toutiao", sel);
    if (found) return found;
  }
  const avatarBlocks = document.querySelectorAll('[class*="avatar"], [class*="Avatar"]');
  for (const block of avatarBlocks) {
    const text = pickAccountText(block);
    if (text) {
      logCandidate("avatar block", '[class*="avatar"]', text);
      return text.trim();
    }
    const sibling = block.parentElement;
    if (sibling) {
      const near = pickAccountText(sibling);
      if (near && near.length <= 30) {
        logCandidate("avatar sibling", "parent", near);
        return near.trim();
      }
    }
  }
  return tryAllImgAlt("toutiao") ?? null;
}

function detectSohuAccountName() {
  console.log("[accountDetect] detect sohu start");
  const selectors = [
    ".user-name",
    ".account-name",
    '[class*="user"]',
    '[class*="account"]',
    '[class*="nickname"]',
    '[class*="Nick"]',
    '[class*="userName"]',
  ];
  for (const sel of selectors) {
    const nodes = document.querySelectorAll(sel);
    for (const el of nodes) {
      const text = pickAccountText(el);
      if (text && text.length <= 30) {
        logCandidate("text", sel, text);
        return text.trim();
      }
    }
  }
  return tryAllImgAlt("sohu") ?? null;
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
  if (message.action !== "detectAccount") return;

  const platform = message.platform;
  console.log("[accountDetect] detectAccount request", { platform, href: location.href });

  const raw = detectAccountNameForPlatform(platform);
  const detectedAccountName = raw ? raw.trim() : null;

  if (detectedAccountName) {
    console.log("[accountDetect] success", { platform, detectedAccountName });
    sendResponse({
      success: true,
      detectedAccountName,
      error: null,
    });
  } else {
    console.warn("[accountDetect] no account detected", { platform, href: location.href, reason: "no candidate after filters" });
    sendResponse({
      success: false,
      detectedAccountName: null,
      error: "未能检测到账号昵称，请确认已登录该平台",
    });
  }
  return true;
});
