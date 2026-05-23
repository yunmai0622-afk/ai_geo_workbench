import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEEKLY_GENERATION_COUNT,
  weeklyGenerationCountClientError,
  weeklyGenerationCountServerError,
} from "../shared/weeklyContentGeneration";
import { generateGeoArticleTopics, type P11ProjectLike, type P11TaskLike } from "./geoArticleLogic";

const project: P11ProjectLike = {
  id: 1,
  enterpriseName: "测试企业",
  industry: "教育",
  targetCustomers: "企业客户",
  coreSellingPoints: "AI 增长",
  competitorNames: ["竞品A"],
  coreKeywords: ["AI 搜索"],
  website: "https://example.com",
};

function task(id: number, title: string): P11TaskLike {
  return {
    id,
    taskType: "行业文章",
    taskName: `任务${id}`,
    priority: "P1",
    generationReason: "缺口说明",
    executionSuggestion: `请编辑\n__GEO_TASK_CARD__\n${JSON.stringify({
      articleTitle: title,
      keyPoints: ["论点1", "论点2", "论点3"],
      targetKeywords: ["词1", "词2", "词3"],
      recommendedPlatform: ["知乎"],
      contentType: "场景指南",
    })}`,
    expectedImpact: "提升可见度",
    status: "todo",
  };
}

describe("weekly content generation count (C4-A)", () => {
  it("validates custom count for client", () => {
    expect(weeklyGenerationCountClientError(0)).toContain("不能少于");
    expect(weeklyGenerationCountClientError(51)).toBe("单次最多生成 50 篇内容");
    expect(weeklyGenerationCountClientError("abc")).toContain("有效");
    expect(weeklyGenerationCountClientError("")).toContain("填写");
    expect(weeklyGenerationCountClientError(14)).toBeNull();
    expect(weeklyGenerationCountServerError(14)).toBeNull();
  });

  it("generates configurable topic count up to target", () => {
    const tasks = [task(1, "标题一"), task(2, "标题二"), task(3, "标题三")];
    const topics = generateGeoArticleTopics({ project, tasks, targetCount: 14 });
    expect(topics).toHaveLength(14);
    const titles = topics.map(t => t.title);
    expect(new Set(titles).size).toBe(14);
    expect(titles.every(t => t.trim().length > 0)).toBe(true);
  });

  it("defaults to task count when targetCount omitted in logic layer", () => {
    const tasks = [task(1, "A"), task(2, "B")];
    const topics = generateGeoArticleTopics({ project, tasks });
    expect(topics).toHaveLength(2);
  });

  it("uses default constant 7 for API layer convention", () => {
    expect(DEFAULT_WEEKLY_GENERATION_COUNT).toBe(7);
  });
});
