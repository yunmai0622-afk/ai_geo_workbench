import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildTaskBoardNextStepSuggestion,
  computeTaskBoardProgress,
  resolvePlatformTaskAction,
  WEEKLY_SERIAL_GENERATION_HINT,
} from "../shared/weeklyContentTaskBoard";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("weeklyContentTaskBoard", () => {
  it("computes progress metrics from platform rows", () => {
    const metrics = computeTaskBoardProgress([
      { status: "UNGENERATED" },
      { status: "DRAFT" },
      { status: "PUBLISH_READY" },
      { status: "PUBLISHED" },
    ]);
    expect(metrics.needGenerate).toBe(1);
    expect(metrics.generated).toBe(3);
    expect(metrics.enqueueReady).toBe(1);
    expect(metrics.published).toBe(1);
  });

  it("builds next step suggestions by task state", () => {
    expect(
      buildTaskBoardNextStepSuggestion({
        needGenerate: 4,
        generated: 0,
        qualityPending: 0,
        enqueueReady: 0,
        queued: 0,
        published: 0,
        total: 4,
      }),
    ).toContain("先选择推荐平台");

    expect(
      buildTaskBoardNextStepSuggestion({
        needGenerate: 2,
        generated: 2,
        qualityPending: 2,
        enqueueReady: 0,
        queued: 0,
        published: 0,
        total: 4,
      }),
    ).toContain("优先完成已生成内容的质检");

    expect(
      buildTaskBoardNextStepSuggestion({
        needGenerate: 0,
        generated: 2,
        qualityPending: 0,
        enqueueReady: 2,
        queued: 0,
        published: 0,
        total: 2,
      }),
    ).toContain("加入发布队列");
  });

  it("maps platform actions to customer labels", () => {
    expect(resolvePlatformTaskAction("UNGENERATED", false).label).toBe("生成平台稿");
    expect(resolvePlatformTaskAction("QUALITY_PENDING", true).label).toBe("查看并质检");
    expect(resolvePlatformTaskAction("PUBLISH_READY", true).label).toBe("加入发布队列");
    expect(resolvePlatformTaskAction("QUEUED", true).label).toBe("查看发布任务");
    expect(resolvePlatformTaskAction("NEEDS_REWRITE", true).label).toBe("重新生成");
  });
});

describe("GEO-V2.1-P1-Content-Workbench-Task-Board-UX", () => {
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const progression = read("client/src/components/weekly/ContentTaskProgressionView.tsx");
  const board = read("client/src/components/weekly/PlatformContentBoard.tsx");
  const advanced = read("client/src/components/weekly/WeeklyAdvancedInfoSections.tsx");
  const collapsible = read("client/src/components/weekly/WeeklyCollapsibleSection.tsx");
  const statusLib = read("shared/weeklyContentTaskStatus.ts");
  const taskBoardLib = read("shared/weeklyContentTaskBoard.ts");

  it("首屏任务卡与进度总览", () => {
    expect(weekly).toContain("weekly-platform-content-page");
    expect(weekly).toContain("内容任务推进");
    expect(weekly).toContain("CurrentContentTaskCard");
    expect(weekly).toContain("TaskProgressOverview");
    expect(progression).toContain("当前内容任务");
    expect(progression).toContain("task-progress-overview");
  });

  it("平台任务板精简展示", () => {
    expect(weekly).toContain("PlatformTaskBoard");
    expect(progression).toContain("平台内容任务");
    expect(board).toContain("weekly-platform-status-");
    expect(board).toContain("生成平台稿");
    expect(board).toContain("查看并质检");
    expect(board).not.toContain("平台稿状态");
    expect(board).not.toContain("质检分");
  });

  it("下一步建议在主内容区", () => {
    expect(weekly).toContain("NextStepSuggestion");
    expect(progression).toContain("下一步建议");
    expect(progression).toContain("task-next-step-suggestion");
  });

  it("高级信息默认折叠", () => {
    expect(weekly).toContain("WeeklyAdvancedInfoSections");
    expect(advanced).toContain("查看品牌与关键词依据");
    expect(advanced).toContain("查看平台策略");
    expect(advanced).toContain("查看高级写作设置");
    expect(advanced).toContain("查看参考内容");
    expect(advanced).toContain("查看生成日志与诊断");
    expect(collapsible).toMatch(/open=\{defaultOpen \? undefined : false\}/);
  });

  it("无 questionId 时展示本月任务列表", () => {
    expect(weekly).toContain("MonthlyContentTaskList");
    expect(weekly).toContain("useSearch");
    expect(weekly).toContain("buildMonthlyContentTaskEntryUrl");
    expect(weekly).toContain("WEEKLY_CONTENT_TASK_UNBOUND_QUESTION_MESSAGE");
    expect(progression).toContain("weekly-monthly-content-task-list");
    expect(progression).toContain("进入推进");
  });

  it("进入推进后同步 query 上下文，避免 search-only URL 变化不触发重渲染", () => {
    expect(weekly).toMatch(
      /const nextEntryContext = parseWeeklyContentEntryContext\(\s*getSearchFromLocation\(entryUrl\)\s*\);/,
    );
    expect(weekly).toContain("setEntryContext(nextEntryContext);");
    expect(weekly).toContain("entryContextRef.current = nextEntryContext;");
    expect(weekly).toContain("entryAutoGenerateHandledRef.current = false;");
    expect(weekly).toContain("setLocation(entryUrl);");
  });

  it("生成中串行提示", () => {
    expect(taskBoardLib).toContain(WEEKLY_SERIAL_GENERATION_HINT);
    expect(progression).toContain("task-platform-serial-hint");
  });

  it("状态文案客户化", () => {
    expect(statusLib).toContain('PUBLISH_READY: "可入队"');
    expect(statusLib).toContain('NEEDS_REWRITE: "生成失败"');
    expect(weekly).not.toMatch(/\bprovider\b/);
    expect(weekly).not.toContain("taskId:");
    expect(weekly).not.toMatch(/>\s*questionId/);
  });

  it("副标题与业务文案", () => {
    expect(weekly).toMatch(/围绕一个 AI 搜索问题，(?:完成|推进).*内容生成.*质检.*发布/);
  });
});

describe("GEO-V1.1-WeeklyContent-TaskWorkbench-UX-P0", () => {
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const board = read("client/src/components/weekly/PlatformContentBoard.tsx");
  const taskCard = read("client/src/components/weekly/WeeklyContentTaskControlCard.tsx");
  const detailSheet = read("client/src/components/weekly/WeeklyContentDetailSheet.tsx");
  const auxiliary = read("client/src/components/weekly/WeeklyAuxiliarySections.tsx");
  const collapsible = read("client/src/components/weekly/WeeklyCollapsibleSection.tsx");
  const queueBlock = read("client/src/components/weekly/WeeklyPublishQueueStatusBlock.tsx");
  const assistant = read("client/src/components/weekly/ContentProductionAssistantPanel.tsx");
  const shell = read("client/src/components/project/EnterpriseProjectShell.tsx");
  const statusLib = read("shared/weeklyContentTaskStatus.ts");

  it("首屏任务总控卡与平台看板", () => {
    expect(weekly).toContain("weekly-platform-content-page");
    expect(weekly).toContain("内容任务推进");
    expect(weekly).toContain("CurrentContentTaskCard");
    expect(queueBlock).toContain("去发布中心");
    expect(read("client/src/components/weekly/ContentTaskProgressionView.tsx")).toContain("关联问题");
    expect(weekly).toContain("PlatformTaskBoard");
    expect(board).toContain("平台内容任务");
    expect(board).toContain("weekly-platform-status-");
  });

  it("完整正文不默认大面积展开", () => {
    expect(detailSheet).toContain("weekly-detail-full-body");
    expect(detailSheet).toContain("展开全文");
    expect(detailSheet).toContain("<details");
    expect(weekly).not.toContain("weekly-section-generated-content");
    expect(weekly).toContain("WeeklyContentDetailSheet");
  });

  it("辅助信息默认折叠", () => {
    expect(auxiliary).toContain("平台规则");
    expect(auxiliary).toContain("AI 实测跟踪");
    expect(auxiliary).toContain("内容模板库");
    expect(auxiliary).toContain("历史内容记录");
    expect(collapsible).toMatch(/open=\{defaultOpen \? undefined : false\}/);
    expect(weekly).toContain("WeeklyAdvancedInfoSections");
  });

  it("平台卡片显示状态与操作", () => {
    expect(board).toContain("lifecycle.label");
    expect(board).toContain("contentAssetLifecycleBadgeClass");
    expect(board).toContain("生成平台稿");
    expect(board).toContain("加入发布队列");
    expect(statusLib).toContain("UNGENERATED");
    expect(statusLib).toContain("PUBLISH_READY");
  });

  it("可发布内容列表与右侧面板", () => {
    expect(assistant).toContain("下一步");
    expect(shell).toContain("ContentProductionAssistantPanel");
    expect(shell).toContain("isWeeklyPage");
  });

  it("空任务状态与交互保留", () => {
    expect(weekly).toContain("暂无内容任务");
    expect(weekly).toContain("查看本月服务计划");
    expect(board).toContain("weekly-primary-");
    expect(weekly).toContain("requestEnqueuePublish");
    expect(taskCard).toContain("weekly-go-enqueue-content");
    expect(weekly).not.toContain("rawAnswer");
    expect(weekly).not.toMatch(/\bprovider\b/);
    expect(weekly).not.toMatch(/\bmock\b/);
    expect(weekly).not.toMatch(/\bschema\b/);
  });

  it("副标题与业务文案", () => {
    expect(weekly).toMatch(/围绕一个 AI 搜索问题，(?:完成|推进).*内容生成.*质检.*发布/);
    expect(auxiliary).not.toMatch(/Prompt 写入规则/);
  });
});
