import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Agent-3 multi-platform local publish", () => {
  it("publisherFactory registers four platforms", () => {
    const factory = read("local-agent/src/agent/platforms/publisherFactory.ts");
    expect(factory).toContain("zhihu: zhihuPublisher");
    expect(factory).toContain("sohu: sohuPublisher");
    expect(factory).toContain("baijiahao: baijiahaoPublisher");
    expect(factory).toContain("toutiao: toutiaoPublisher");
    expect(factory).toContain("publishWithPlatform");
  });

  it("base publish flow logs required steps", () => {
    const base = read("local-agent/src/agent/platforms/basePublisher.ts");
    for (const step of ["open_home", "detect_account", "open_write", "fill_title", "fill_content"]) {
      expect(base).toContain(`"${step}"`);
    }
    expect(base).toContain("account_mismatch");
    expect(base).toContain("manual_required");
    expect(base).toContain("draft_saved");
  });

  it("each platform has distinct home/write urls", () => {
    expect(read("local-agent/src/agent/platforms/zhihuPublisher.ts")).toContain(
      "zhuanlan.zhihu.com/write",
    );
    expect(read("local-agent/src/agent/platforms/sohuPublisher.ts")).toContain("mp.sohu.com");
    expect(read("local-agent/src/agent/platforms/baijiahaoPublisher.ts")).toContain("baijiahao.baidu.com");
    expect(read("local-agent/src/agent/platforms/toutiaoPublisher.ts")).toContain("mp.toutiao.com");
  });

  it("does not mock success or store credentials", () => {
    expect(read("local-agent/src/agent/storage.ts")).not.toMatch(/password|cookie/i);
    expect(read("local-agent/src/agent/platforms/basePublisher.ts")).not.toMatch(/mock|假装/i);
  });

  it("Web creates pending_agent for binding platforms with local profile", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("isBindingPublishPlatform(input.platform)");
    expect(router).toContain("publishBlockedNoLocalProfileMessage");
    expect(read("server/agentPublishTasks.ts")).toContain("AGENT_POLL_PLATFORMS");
  });

  it("poll returns all four agent platforms", () => {
    expect(read("server/agentPublishTasks.ts")).toContain('"sohu"');
    expect(read("server/agentPublishTasks.ts")).toContain('"baijiahao"');
    expect(read("server/agentPublishTasks.ts")).toContain('"toutiao"');
    expect(read("server/agentPublishTasks.ts")).toContain('action: "publish"');
  });

  it("zhihu publisher uploads cover and clicks publish", () => {
    const zhihu = read("local-agent/src/agent/platforms/zhihuPublisher.ts");
    expect(zhihu).toContain("uploadZhihuCover");
    expect(zhihu).toContain("attemptPublishArticle");
    expect(zhihu).toContain('"publish_article"');
    expect(zhihu).toContain('status: "completed"');
    expect(zhihu).toContain("override async attemptSaveDraft");
    expect(zhihu).toContain("save_timestamp_or_autosave_hint");
  });

  it("platform account matrix supports five binding platforms", () => {
    const ui =
      read("client/src/components/platformAccounts/PlatformAccountMatrix.tsx") +
      read("client/src/components/platformAccounts/usePlatformAccountBinding.ts");
    expect(ui).toContain("createPlatformProfile");
    expect(ui).not.toContain("本轮仅支持通过本地客户端绑定知乎");
    expect(ui).toContain("bind-publish-account-");
    expect(read("shared/platformAccountVerify.ts")).toContain("netease");
  });

  it("local HTTP server accepts binding platforms on create", () => {
    const server = read("local-agent/src/agent/localServer.ts");
    expect(server).toContain("LOCAL_AGENT_BINDING_PLATFORMS");
    expect(server).not.toContain('body.platform !== "zhihu"');
    expect(read("local-agent/src/agent/platforms/publisherFactory.ts")).toContain("netease");
  });

  it("zhihu legacy path preserved via platformActions", () => {
    expect(read("local-agent/src/agent/platformActions.ts")).toContain("detectZhihuAccount");
    expect(read("local-agent/src/agent/publishWorker.ts")).toContain("publishWithPlatform");
  });
});
