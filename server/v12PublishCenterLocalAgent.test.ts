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
  const overviewBar = read("client/src/components/publishing/PublishWeeklyOverviewBar.tsx");
  const cardGrid = read("client/src/components/publishing/PublishPlatformCardGrid.tsx");
  const sidePanel = read("client/src/components/publishing/PublishActionSidePanel.tsx");
  const queueTable = read("client/src/components/publishing/PublishTaskQueueTable.tsx");
  const executionTabs = read("client/src/lib/publishExecutionTabs.ts");
  const publishUi =
    page + overviewBar + board + statusCard + stepsPanel + display + cardGrid + sidePanel + queueTable + executionTabs;

  it("re-exports publish center from V12FlowPages", () => {
    expect(flow).toContain(
      'export { ContentPublishingCenterPage as ContentPublishingFlowPage } from "./ContentPublishingCenterPage"',
    );
    expect(flow).not.toContain("export function ContentPublishingFlowPage");
  });

  it("first screen highlights publish execution center and task queue", () => {
    for (const text of [
      "publish-center-page",
      "发布执行中心",
      "PublishStatusBar",
      "publish-task-queue-module",
      "publish-queue-tab-pending",
      "PublishTaskQueueTable",
      "LocalAgentPublishStepsPanel",
    ]) {
      expect(publishUi + page).toContain(text);
    }
    expect(page).toContain("待发布");
    expect(page).toContain("发布中");
    expect(page).toContain("失败");
    expect(queueTable).toContain("查看任务");
    expect(queueTable).toContain("回填链接");
  });

  it("account client tools are folded, not first-screen heroes", () => {
    expect(page).toContain("publish-account-client-fold");
    expect(page).toContain("账号与客户端");
    expect(page).not.toContain("AiPageHero");
    expect(page).not.toContain("资产发布记录");
    expect(page).not.toContain("browser-extension.zip");
    expect(page).not.toContain("下载 Chrome 插件");
  });

  it("keeps manual publish mutations without built-in GEO page auto publish", () => {
    expect(page).toContain("createManualPublishRecord");
    expect(page).toContain("updateManualPublishRecord");
    expect(page).toContain("publishTasks.create");
    expect(page).not.toContain("trpc.geo.articles.publish.useMutation");
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
