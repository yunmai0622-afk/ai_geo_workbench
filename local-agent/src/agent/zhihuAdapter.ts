/** 兼容层：知乎检测与发布入口 */
export { closeContext } from "./platforms/browserSession";
export type { AgentResult, AgentStep } from "./platformActions";
export {
  detectPlatformAccount,
  fillZhihuDraft,
  openLoginWindow,
  openPlatformWritePage,
  openZhihuWritePage,
} from "./platformActions";

import { detectPlatformAccount as detectPlatformAccountImpl } from "./platformActions";

export async function detectZhihuAccount(profileId: string) {
  console.log("[agent-zhihu] detectZhihuAccount", { profileId });
  return detectPlatformAccountImpl(profileId);
}

export async function verifyZhihuSessionReuse(profileId: string) {
  const { zhihuPublisher } = await import("./platforms/zhihuPublisher");
  return zhihuPublisher.verifySessionReuseAndWritePage(profileId);
}
