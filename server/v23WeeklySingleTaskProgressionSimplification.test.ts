import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.3 weekly single task progression simplification", () => {
  it("renders questionId weekly route as a single task progression page", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");

    expect(weekly).toContain("isSingleTaskProgression");
    expect(weekly).toContain("内容任务推进");
    expect(weekly).toContain("围绕一个 AI 搜索问题，完成内容生成、质检和发布准备。");
    expect(weekly).toContain('data-testid="weekly-single-task-progression"');
    expect(weekly).toContain('data-testid="single-task-question"');
    expect(weekly).toContain('data-testid="single-task-current-status"');
    expect(weekly).toContain('data-testid="single-task-next-action"');
    expect(weekly).toContain('data-testid="single-task-current-blocker"');
  });

  it("keeps operational publish details folded on the single task page", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");

    expect(weekly).toContain('data-testid="weekly-single-task-ops-info"');
    expect(weekly).toContain("运营发布信息");
    expect(weekly).toContain("默认折叠；需要时查看平台适配、发布账号和生成日志。");
    expect(weekly).toContain("{isContentProductionWorkbench && !isSingleTaskProgression ? (");
    expect(weekly).toContain("{enabled && isContentProductionWorkbench && !isSingleTaskProgression ? (");
  });

  it("shows publish task create failures as the current blocker", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");

    expect(weekly).toContain("singleTaskPublishQueueError");
    expect(weekly).toContain("发布任务创建失败");
    expect(weekly).toContain("setSingleTaskPublishQueueError({ articleId, message });");
    expect(weekly).toContain("setSingleTaskPublishQueueError({ articleId: article.id, message });");
  });

  it("highlights content production navigation for questionId weekly URLs", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    const shell = read("client/src/components/project/EnterpriseProjectShell.tsx");

    expect(layout).toContain('const isWeeklySingleTask = pathname === "/weekly" && Boolean(searchParams.get("questionId"));');
    expect(layout).toContain('item.key === "content-production" && isWeeklySingleTask');
    expect(layout).toContain('searchParams.get("mode") === CONTENT_PRODUCTION_MODE || isWeeklySingleTask');
    expect(shell).toContain('const isWeeklySingleTaskProgression = isWeeklyPage && Boolean(routeSearchParams.get("questionId"));');
  });

  it("returns publish task error fields needed by single task status", () => {
    const router = read("server/publishTasksRouter.ts");
    const recentBlock = router.slice(router.indexOf("listRecentByProject:"));

    expect(recentBlock).toContain("accountVerificationStatus: publishTasks.accountVerificationStatus");
    expect(recentBlock).toContain("errorMessage: publishTasks.errorMessage");
  });
});
