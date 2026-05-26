import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Phase3 publish center Local Agent UI", () => {
  const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
  const flow = read("client/src/pages/V12FlowPages.tsx");
  const display = read("client/src/lib/publishCenterDisplay.ts");
  const board = read("client/src/components/publishing/PublishTaskColumnBoard.tsx");
  const statusCard = read("client/src/components/publishing/LocalAgentStatusCard.tsx");
  const stepsPanel = read("client/src/components/publishing/LocalAgentPublishStepsPanel.tsx");
  const publishUi = page + board + statusCard + stepsPanel + display;

  it("re-exports publish center from V12FlowPages", () => {
    expect(flow).toContain(
      'export { ContentPublishingCenterPage as ContentPublishingFlowPage } from "./ContentPublishingCenterPage"',
    );
    expect(flow).not.toContain("export function ContentPublishingFlowPage");
  });

  it("first screen highlights Local Agent task center", () => {
    for (const text of [
      "publish-center-page",
      "发布中心",
      "Local Agent 本地发布任务中心",
      "local-agent-status-card",
      "publish-task-columns",
      "publish-column-pending",
      "publish-column-active",
      "publish-column-done",
      "publish-center-steps-panel",
    ]) {
      expect(publishUi).toContain(text);
    }
    expect(publishUi).toContain("待发布");
    expect(publishUi).toContain("发布中 / 待确认");
    expect(publishUi).toContain("已发布 / 待填链接");
    expect(publishUi).toContain("预览内容");
    expect(publishUi).toContain("开始本地发布");
    expect(publishUi).toContain("填写公开链接");
  });

  it("chrome extension and retest pools are folded, not first-screen heroes", () => {
    expect(page).toContain("publish-chrome-legacy-fold");
    expect(page).toContain("旧版 Chrome 插件入口，仅用于历史兼容。新项目建议使用 Local Agent。");
    expect(page).toContain("publish-retest-rewrite-fold");
    expect(page).not.toContain("AiPageHero");
    expect(page).not.toContain("资产发布记录");
    expect(page).not.toContain("browser-extension.zip");
    expect(page).not.toContain("下载 Chrome 插件");
  });

  it("keeps manual publish mutations without auto publish", () => {
    expect(page).toContain("createManualPublishRecord");
    expect(page).toContain("updateManualPublishRecord");
    expect(page).not.toContain("trpc.geo.articles.publish.useMutation");
    expect(page).not.toContain("publishTasks.create");
  });

  it("does not expose engineering fields in customer UI", () => {
    for (const token of ["localProfileId", "agentLog", "provider", "adapter", "mock"]) {
      expect(publishUi).not.toContain(token);
    }
  });

  it("publish steps panel lists seven customer steps", () => {
    expect(display).toContain("打开 Local Agent");
    expect(display).toContain("进入收录监测");
    expect(display.match(/LOCAL_AGENT_PUBLISH_STEPS/g)?.length).toBeGreaterThan(0);
  });
});
