import { type BrowserContext, chromium } from "playwright";
import { requireAccount } from "../profileManager";

const openContexts = new Map<string, BrowserContext>();

export async function getOrLaunchContext(profileId: string, headless = false): Promise<BrowserContext> {
  const existing = openContexts.get(profileId);
  if (existing) {
    try {
      if (existing.browser()?.isConnected()) {
        return existing;
      }
    } catch {
      /* stale */
    }
    await closeContext(profileId);
  }

  const account = requireAccount(profileId);
  console.log("[browser-session] launch persistent context", {
    profileId,
    profilePath: account.profilePath,
    headless,
  });
  const context = await chromium.launchPersistentContext(account.profilePath, {
    headless,
    viewport: { width: 1280, height: 900 },
    locale: "zh-CN",
    ignoreHTTPSErrors: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  openContexts.set(profileId, context);
  return context;
}

export function getOpenContext(profileId: string): BrowserContext | undefined {
  return openContexts.get(profileId);
}

export async function closeContext(profileId: string): Promise<void> {
  const ctx = openContexts.get(profileId);
  if (ctx) {
    await ctx.close().catch(() => {});
    openContexts.delete(profileId);
  }
}

/** 模拟客户端重启：关闭所有已打开的 Playwright context（accounts.json / profilePath 保留） */
export async function closeAllContexts(): Promise<void> {
  const ids = [...openContexts.keys()];
  for (const id of ids) {
    await closeContext(id);
  }
}
