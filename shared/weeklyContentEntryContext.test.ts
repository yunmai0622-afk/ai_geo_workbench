import { describe, expect, it } from "vitest";
import {
  appendWeeklyContentEntryParams,
  buildMonthlyContentTaskEntryUrl,
  buildWeeklyContentEntryUrl,
  parseQuestionIdFromActionUrl,
  parseProjectIdFromActionUrl,
  parseProjectIdFromSearch,
  parseWeeklyContentEntryContext,
  resolveMonthlyContentTaskQuestionId,
  resolveMonthlyContentTaskProjectId,
  resolveWeeklyContentSourceTypeLabel,
} from "./weeklyContentEntryContext";

describe("weeklyContentEntryContext", () => {
  it("builds and parses weekly entry query", () => {
    const url = buildWeeklyContentEntryUrl(12, {
      questionId: 5,
      taskId: 9,
      questionText: "哪家知识付费平台好",
      sourceType: "search_pool",
      autoGenerate: true,
    });
    expect(url).toContain("projectId=12");
    expect(url).toContain("questionId=5");
    expect(url).toContain("taskId=9");
    const parsed = parseWeeklyContentEntryContext(url.split("?")[1] ?? "");
    expect(parsed.questionId).toBe(5);
    expect(parsed.taskId).toBe(9);
    expect(parsed.questionText).toBe("哪家知识付费平台好");
    expect(parsed.autoGenerate).toBe(true);
  });

  it("uses URL parameters as the complete entry context without cached fallbacks", () => {
    expect(parseWeeklyContentEntryContext("?projectId=210001&questionId=480001&sourceType=optimization_task")).toEqual({
      questionId: 480001,
      sourceType: "optimization_task",
      taskId: undefined,
      questionText: undefined,
      selectedTitle: undefined,
      relatedGeoGap: undefined,
      articleId: undefined,
      platform: undefined,
      autoGenerate: undefined,
      pendingContentTab: undefined,
    });
  });

  it("appends params to existing query", () => {
    const url = appendWeeklyContentEntryParams("/weekly?projectId=3", { taskId: 7 });
    expect(url).toContain("projectId=3");
    expect(url).toContain("taskId=7");
  });

  it("maps source type labels for customers", () => {
    expect(resolveWeeklyContentSourceTypeLabel("search_pool")).toBe("AI搜索问题");
    expect(resolveWeeklyContentSourceTypeLabel()).toBe("AI搜索问题");
  });

  it("resolves monthly content task questionId from relatedQuestionId, metadata, actionUrl", () => {
    expect(
      resolveMonthlyContentTaskQuestionId({
        relatedQuestionId: 42,
        metadata: { questionId: 99 },
        actionUrl: "/weekly?questionId=7",
      }),
    ).toBe(42);

    expect(
      resolveMonthlyContentTaskQuestionId({
        relatedQuestionId: null,
        metadata: { questionId: 99 },
        actionUrl: "/weekly?questionId=7",
      }),
    ).toBe(99);

    expect(
      resolveMonthlyContentTaskQuestionId({
        relatedQuestionId: null,
        metadata: null,
        actionUrl: "/weekly?questionId=7",
      }),
    ).toBe(7);

    expect(parseQuestionIdFromActionUrl("/weekly")).toBeUndefined();
    expect(
      resolveMonthlyContentTaskQuestionId({
        relatedQuestionId: null,
        metadata: { sourceQuestionId: "88" },
        actionUrl: "/weekly?questionId=7",
      }),
    ).toBe(88);

    expect(
      resolveMonthlyContentTaskQuestionId({
        relatedQuestionId: null,
        questionId: 55,
        metadata: null,
        actionUrl: "/weekly",
      }),
    ).toBe(55);
  });

  it("builds monthly content task entry url with project fallback", () => {
    const fromCurrentSearch = buildMonthlyContentTaskEntryUrl({
      selectedProjectId: null,
      currentSearch: "?projectId=210001",
      task: {
        relatedQuestionId: null,
        metadata: null,
        actionUrl: "/weekly?questionId=330001",
      },
    });
    expect(fromCurrentSearch).toBe("/weekly?projectId=210001&questionId=330001&sourceType=optimization_task");

    const fromTask = buildMonthlyContentTaskEntryUrl({
      task: {
        projectId: 210002,
        relatedQuestionId: null,
        metadata: { questionId: "330002" },
        actionUrl: "/weekly",
      },
    });
    expect(fromTask).toBe("/weekly?projectId=210002&questionId=330002&sourceType=optimization_task");
  });

  it("parses projectId from search and actionUrl", () => {
    expect(parseProjectIdFromSearch("?projectId=210001")).toBe(210001);
    expect(parseProjectIdFromActionUrl("/weekly?projectId=210001&questionId=330001")).toBe(210001);
    expect(resolveMonthlyContentTaskProjectId({
      currentSearch: "",
      selectedProjectId: null,
      task: { projectId: null, actionUrl: "/weekly?projectId=210003&questionId=330001" },
    })).toBe(210003);
    expect(buildMonthlyContentTaskEntryUrl({
      selectedProjectId: 210001,
      task: { actionUrl: "/weekly" },
    })).toBeNull();
  });
});
