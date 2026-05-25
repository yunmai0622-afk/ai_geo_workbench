import { getAccountByProfileId } from "./storage";
import { getPublisherForPlatform, isLocalAgentPlatform } from "./platforms/publisherFactory";
import type { LocalPublishPlatform } from "./platforms/basePublisher";

export type AgentStep =
  | "ok"
  | "login_required"
  | "account_not_detected"
  | "page_context_lost"
  | "selector_not_found"
  | "write_page_not_found"
  | "editor_not_found"
  | "title_input_not_found"
  | "content_input_not_found"
  | "submit_failed"
  | "submit_button_not_found"
  | "account_mismatch";

export type AgentResult<T = unknown> = {
  ok: boolean;
  step: AgentStep;
  message: string;
  errorType?: string;
  data?: T;
};

function resolvePlatform(profileId: string): LocalPublishPlatform | null {
  const acc = getAccountByProfileId(profileId);
  if (!acc) return null;
  return isLocalAgentPlatform(acc.platform) ? acc.platform : null;
}

export async function openLoginWindow(profileId: string): Promise<AgentResult<{ url: string }>> {
  const platform = resolvePlatform(profileId);
  if (!platform) {
    return { ok: false, step: "write_page_not_found", message: `profile_not_found: ${profileId}` };
  }
  const publisher = getPublisherForPlatform(platform)!;
  const result = await publisher.openLoginHome(profileId);
  return {
    ok: result.ok,
    step: result.ok ? "ok" : "write_page_not_found",
    message: result.message,
    data: result.url ? { url: result.url } : undefined,
  };
}

export async function detectPlatformAccount(profileId: string): Promise<
  AgentResult<{ accountName: string | null }>
> {
  const platform = resolvePlatform(profileId);
  if (!platform) {
    return { ok: false, step: "account_not_detected", message: `profile_not_found: ${profileId}` };
  }
  const publisher = getPublisherForPlatform(platform)!;
  const result = await publisher.detectAccountSession(profileId);
  const step: AgentStep = result.ok
    ? "ok"
    : result.errorType === "login_required"
      ? "login_required"
      : result.errorType === "page_context_lost"
        ? "page_context_lost"
        : result.errorType === "selector_not_found"
          ? "selector_not_found"
          : "account_not_detected";
  return {
    ok: result.ok,
    step,
    message: result.message,
    data: { accountName: result.accountName },
  };
}

export async function openPlatformWritePage(
  profileId: string,
  clickSource = "client_publish_button",
): Promise<
  AgentResult<{ url: string; logPath?: string; triedUrls?: string[]; layer?: string }>
> {
  const platform = resolvePlatform(profileId);
  if (!platform) {
    return {
      ok: false,
      step: "write_page_not_found",
      message: `profile_not_found: ${profileId}`,
      errorType: "profile_not_found",
    };
  }

  const result =
    platform === "zhihu"
      ? await (async () => {
          const { zhihuPublisher } = await import("./platforms/zhihuPublisher");
          return zhihuPublisher.openWritePageWithCandidates(profileId, clickSource);
        })()
      : await getPublisherForPlatform(platform)!.openWritePageTest(profileId);

  const err = "errorType" in result ? (result as { errorType?: string }).errorType : undefined;
  const step: AgentStep = result.ok
    ? "ok"
    : err === "login_required" || err === "session_expired"
      ? "login_required"
      : "write_page_not_found";

  const layer =
    platform === "zhihu" && "layer" in result
      ? (result as { layer?: string }).layer ?? "zhihu"
      : platform;

  console.log("[agent] openPlatformWritePage", {
    clickSource,
    profileId,
    platform,
    layer,
    ok: result.ok,
    url: result.url,
    errorType: err,
  });

  return {
    ok: result.ok,
    step,
    message: result.message,
    errorType: err,
    data: result.url
      ? {
          url: result.url,
          logPath: "logPath" in result ? (result as { logPath?: string }).logPath : undefined,
          triedUrls: "triedUrls" in result ? (result as { triedUrls?: string[] }).triedUrls : undefined,
          layer,
        }
      : undefined,
  };
}

/** @deprecated 使用 detectPlatformAccount */
export const detectZhihuAccount = detectPlatformAccount;

/** @deprecated 使用 openPlatformWritePage */
export const openZhihuWritePage = openPlatformWritePage;

export async function fillZhihuDraft(
  profileId: string,
  title: string,
  content: string,
): Promise<AgentResult<{ titleFilled: boolean; contentFilled: boolean }>> {
  const openResult = await openPlatformWritePage(profileId);
  if (!openResult.ok) {
    return {
      ok: false,
      step: openResult.step,
      message: openResult.message,
      data: { titleFilled: false, contentFilled: false },
    };
  }
  const platform = resolvePlatform(profileId);
  const publisher = platform ? getPublisherForPlatform(platform) : null;
  if (!publisher) {
    return { ok: false, step: "write_page_not_found", message: "publisher 不可用" };
  }
  const outcome = await publisher.publish({
    taskId: 0,
    platform: publisher.platform,
    localProfileId: profileId,
    expectedAccountName: "",
    title,
    content,
    action: "save_draft",
  });
  const titleOk = outcome.logs.some(l => l.step === "fill_title" && l.status === "ok");
  const contentOk = outcome.logs.some(l => l.step === "fill_content" && l.status === "ok");
  return {
    ok: titleOk && contentOk,
    step: titleOk && contentOk ? "ok" : "content_input_not_found",
    message: outcome.errorMessage ?? outcome.status,
    data: { titleFilled: titleOk, contentFilled: contentOk },
  };
}
