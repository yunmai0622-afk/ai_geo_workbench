import { describe, expect, it } from "vitest";
import {
  buildArticleTopicIdSet,
  countUnassignedPendingTopics,
  matchTopicToPlatform,
  resolvePendingPlatformTopic,
} from "./platformTopicAllocation";
import { taskIdSetFromList } from "./platformContentDiagnosisGate";
import { GEO_OPTIMIZATION_TASK_CARD_MARK } from "./geoContentTaskSource";

function taskCard(platforms: string[], id = 1) {
  const card = {
    articleTitle: "测试选题",
    keyPoints: ["a"],
    targetKeywords: ["b"],
    recommendedPlatform: platforms,
    contentType: "场景指南",
  };
  return {
    id,
    executionSuggestion: `说明\n${GEO_OPTIMIZATION_TASK_CARD_MARK}\n${JSON.stringify(card)}`,
  };
}

describe("platformTopicAllocation", () => {
  it("matches zhihu aliases on recommended platforms", () => {
    expect(matchTopicToPlatform(["知乎专栏"], "知乎")).toBe(true);
    expect(matchTopicToPlatform(["zhihu"], "知乎")).toBe(true);
    expect(matchTopicToPlatform(["小红书"], "知乎")).toBe(false);
  });

  it("picks unassigned topic for zhihu after another platform consumed one topic", () => {
    const topics = [
      { id: 1, optimizationTaskId: 10, title: "A" },
      { id: 2, optimizationTaskId: 11, title: "B" },
    ];
    const tasks = [taskCard(["小红书"], 10), taskCard(["知乎"], 11)];
    const articleTopicIds = buildArticleTopicIdSet([{ topicId: 1 }]);
    const taskIdSet = taskIdSetFromList([10, 11]);

    const pending = resolvePendingPlatformTopic({
      platformKey: "zhihu",
      platformLabel: "知乎",
      topicRows: topics,
      articleTopicIds,
      tasks,
      taskIdSet,
      activeTaskId: 10,
    });

    expect(pending?.id).toBe(2);
  });

  it("falls back to relax match when active task topic is already generated", () => {
    const topics = [
      { id: 1, optimizationTaskId: 10, title: "A" },
      { id: 2, optimizationTaskId: 11, title: "B" },
    ];
    const tasks = [taskCard(["小红书"], 10), taskCard(["百家号"], 11)];
    const articleTopicIds = buildArticleTopicIdSet([{ topicId: 1 }]);
    const taskIdSet = taskIdSetFromList([10, 11]);

    const pending = resolvePendingPlatformTopic({
      platformKey: "zhihu",
      platformLabel: "知乎",
      topicRows: topics,
      articleTopicIds,
      tasks,
      taskIdSet,
      activeTaskId: 10,
    });

    expect(pending?.id).toBe(2);
  });

  it("counts unassigned pending topics", () => {
    const topics = [
      { id: 1, optimizationTaskId: 10, title: "A" },
      { id: 2, optimizationTaskId: 11, title: "B" },
    ];
    const articleTopicIds = buildArticleTopicIdSet([{ topicId: 1 }]);
    const taskIdSet = taskIdSetFromList([10, 11]);
    expect(countUnassignedPendingTopics(topics, articleTopicIds, taskIdSet)).toBe(1);
  });
});
