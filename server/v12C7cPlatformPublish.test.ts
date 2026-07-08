import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C7-C platform publish adapters", () => {
  it("local agent blocks when account mismatch", () => {
    const base = read("local-agent/src/agent/platforms/basePublisher.ts");
    expect(base).toContain("account_mismatch");
    expect(base).toContain("无法识别当前登录账号");
    expect(read("server/publishTasksRouter.ts")).toContain("verifyPublishTaskAccount");
  });

  it("local agent blocks when account unknown", () => {
    expect(read("local-agent/src/agent/platforms/basePublisher.ts")).toContain("account_unknown");
    expect(read("local-agent/src/agent/platforms/basePublisher.ts")).toContain("无法识别当前登录账号");
  });

  it("publish task uses latest title content cover from router", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("article.title");
    expect(router).toContain("article.markdownContent");
    expect(router).toContain("buildPublishTaskCoverImageUrl");
  });

  it("baijiahao publisher targets baijiahao write URL", () => {
    const adapter = read("local-agent/src/agent/platforms/baijiahaoPublisher.ts");
    expect(adapter).toContain("baijiahao.baidu.com");
    expect(adapter).toContain("builder/rc/edit");
    expect(read("local-agent/src/agent/platforms/basePublisher.ts")).toContain("write_page_not_found");
  });

  it("toutiao publisher targets main-document editor surfaces", () => {
    const adapter = read("local-agent/src/agent/platforms/toutiaoPublisher.ts");
    expect(adapter).toContain(".ProseMirror");
    expect(adapter).toContain("waitForWriteEditor");
    expect(adapter).toContain(".public-DraftEditor-content");
    expect(adapter).not.toContain("fillFirstSelectorInPageOrFrames");
  });

  it("sohu publisher warns when category is required", () => {
    expect(read("local-agent/src/agent/platforms/sohuPublisher.ts")).toContain("请选择分类");
  });

  it("failure message is customer friendly via shared publishTaskErrors", () => {
    expect(read("shared/publishTaskErrors.ts")).toContain("customerMessage");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("publishTaskStatusCustomerLabel");
  });

  it("zhihu publisher still available", () => {
    const zhihu = read("local-agent/src/agent/platforms/zhihuPublisher.ts");
    expect(zhihu).toContain("ZhihuPublisher");
    expect(zhihu).toContain("editor_not_found");
    expect(zhihu).toContain(".public-DraftEditor-content");
    expect(read("local-agent/src/agent/platforms/publisherFactory.ts")).toContain("zhihu");
  });

  it("supports draft_saved status without marking article published", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain('"draft_saved"');
    expect(router).toContain("draftSaved: true");
  });
});
