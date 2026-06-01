import type { LocalPublishPlatform, LocalPublishTask, LocalPublishResult } from "./basePublisher";
import { baijiahaoPublisher } from "./baijiahaoPublisher";
import { neteasePublisher } from "./neteasePublisher";
import { sohuPublisher } from "./sohuPublisher";
import { toutiaoPublisher } from "./toutiaoPublisher";
import { zhihuPublisher } from "./zhihuPublisher";
import type { BasePlatformPublisher } from "./basePublisher";
import type { StoredPlatform } from "../storage";

const BINDING_PUBLISHERS: Record<StoredPlatform, BasePlatformPublisher> = {
  zhihu: zhihuPublisher,
  sohu: sohuPublisher,
  baijiahao: baijiahaoPublisher,
  toutiao: toutiaoPublisher,
  netease: neteasePublisher,
};

/** 支持 Local Agent 绑定的平台 */
export const LOCAL_AGENT_BINDING_PLATFORMS = Object.keys(BINDING_PUBLISHERS) as StoredPlatform[];

/** 支持自动/半自动发布的平台 */
export const LOCAL_AGENT_PLATFORMS = [
  "zhihu",
  "sohu",
  "baijiahao",
  "toutiao",
  "netease",
] as LocalPublishPlatform[];

export function isBindingPlatform(platform: string): platform is StoredPlatform {
  return (LOCAL_AGENT_BINDING_PLATFORMS as readonly string[]).includes(platform);
}

export function isLocalAgentPlatform(platform: string): platform is LocalPublishPlatform {
  return (LOCAL_AGENT_PLATFORMS as readonly string[]).includes(platform);
}

export function getPublisherForPlatform(platform: string): BasePlatformPublisher | null {
  if (!isBindingPlatform(platform)) return null;
  return BINDING_PUBLISHERS[platform];
}

export async function publishWithPlatform(task: LocalPublishTask): Promise<LocalPublishResult> {
  const publisher = getPublisherForPlatform(task.platform);
  if (!publisher || !isLocalAgentPlatform(task.platform)) {
    return {
      status: "failed",
      errorType: "unsupported_platform",
      errorMessage: `不支持的平台：${task.platform}`,
      logs: [
        {
          step: "publisher_factory",
          status: "failed",
          message: "unsupported_platform",
          createdAt: new Date().toISOString(),
        },
      ],
    };
  }
  return publisher.publish(task);
}
