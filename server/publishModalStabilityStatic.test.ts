import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("publish modal stability static", () => {
  it("WeeklyContentPage 弹窗打开不自动 sync 到 Web", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("hydratePublishDialogAgent({ syncToWeb: false })");
    expect(weekly).toContain("publishDialogAccountSnapshot");
    expect(weekly).not.toMatch(/useEffect\(\(\) => \{[\s\S]*publishDialogOpen[\s\S]*refreshLocalAgentHealth/);
  });

  it("刷新账号状态由用户触发且可 syncToWeb", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("hydratePublishDialogAgent({ syncToWeb: true })");
    expect(weekly).toContain("publish-dialog-nickname-pending-hint");
  });

  it("local-agent 发布不因昵称待识别阻断", () => {
    const zhihu = read("local-agent/src/agent/platforms/zhihuPublisher.ts");
    expect(zhihu).toContain("shouldBlockPublishForAccountNameMismatch");
    expect(zhihu).toContain("昵称待识别，继续填稿");
  });
});
