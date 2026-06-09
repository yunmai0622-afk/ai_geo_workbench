import { describe, expect, it } from "vitest";
import {
  appendWeeklyContentEntryParams,
  buildWeeklyContentEntryUrl,
  parseWeeklyContentEntryContext,
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

  it("appends params to existing query", () => {
    const url = appendWeeklyContentEntryParams("/weekly?projectId=3", { taskId: 7 });
    expect(url).toContain("projectId=3");
    expect(url).toContain("taskId=7");
  });

  it("maps source type labels for customers", () => {
    expect(resolveWeeklyContentSourceTypeLabel("search_pool")).toBe("AI搜索问题");
    expect(resolveWeeklyContentSourceTypeLabel()).toBe("AI搜索问题");
  });
});
