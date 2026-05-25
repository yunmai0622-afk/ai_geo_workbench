import type { LocalPublishPlatform, LocalPublishTask, LocalPublishResult } from "./basePublisher";
import { baijiahaoPublisher } from "./baijiahaoPublisher";
import { sohuPublisher } from "./sohuPublisher";
import { toutiaoPublisher } from "./toutiaoPublisher";
import { zhihuPublisher } from "./zhihuPublisher";
import type { BasePlatformPublisher } from "./basePublisher";

const PUBLISHERS: Record<LocalPublishPlatform, BasePlatformPublisher> = {
  zhihu: zhihuPublisher,
  sohu: sohuPublisher,
  baijiahao: baijiahaoPublisher,
  toutiao: toutiaoPublisher,
};

export const LOCAL_AGENT_PLATFORMS = Object.keys(PUBLISHERS) as LocalPublishPlatform[];

export function isLocalAgentPlatform(platform: string): platform is LocalPublishPlatform {
  return (LOCAL_AGENT_PLATFORMS as readonly string[]).includes(platform);
}

export function getPublisherForPlatform(platform: string): BasePlatformPublisher | null {
  if (!isLocalAgentPlatform(platform)) return null;
  return PUBLISHERS[platform];
}

export async function publishWithPlatform(task: LocalPublishTask): Promise<LocalPublishResult> {
  const publisher = getPublisherForPlatform(task.platform);
  if (!publisher) {
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
