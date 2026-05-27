import { describe, expect, it } from "vitest";
import {
  evaluatePlatformContentDiagnosisGate,
  isTopicBoundToProjectTasks,
  PLATFORM_CONTENT_NO_AI_DIAGNOSIS_MESSAGE,
  PLATFORM_CONTENT_NO_OPTIMIZATION_TASKS_MESSAGE,
  PLATFORM_CONTENT_NO_TOPICS_MESSAGE,
  PLATFORM_CONTENT_STALE_TOPICS_MESSAGE,
  taskIdSetFromList,
} from "@shared/platformContentDiagnosisGate";

describe("platform content diagnosis gate (P0)", () => {
  it("requires AI analysis before generation", () => {
    const gate = evaluatePlatformContentDiagnosisGate({
      analysisCount: 0,
      taskIds: [],
      topics: [],
    });
    expect(gate.ready).toBe(false);
    expect(gate.stage).toBe("no_analysis");
    expect(gate.message).toBe(PLATFORM_CONTENT_NO_AI_DIAGNOSIS_MESSAGE);
  });

  it("requires optimization tasks when analysis exists", () => {
    const gate = evaluatePlatformContentDiagnosisGate({
      analysisCount: 9,
      taskIds: [],
      topics: [],
    });
    expect(gate.ready).toBe(false);
    expect(gate.stage).toBe("no_tasks");
    expect(gate.message).toBe(PLATFORM_CONTENT_NO_OPTIMIZATION_TASKS_MESSAGE);
  });

  it("detects stale topics after task regeneration", () => {
    const taskIds = taskIdSetFromList([101, 102]);
    expect(isTopicBoundToProjectTasks({ optimizationTaskId: 99 }, taskIds)).toBe(false);
    const gate = evaluatePlatformContentDiagnosisGate({
      analysisCount: 9,
      taskIds: [101, 102],
      topics: [{ id: 1, optimizationTaskId: 99 }],
    });
    expect(gate.stage).toBe("stale_topics");
    expect(gate.message).toBe(PLATFORM_CONTENT_STALE_TOPICS_MESSAGE);
  });

  it("passes when bound topics exist for current tasks", () => {
    const gate = evaluatePlatformContentDiagnosisGate({
      analysisCount: 9,
      taskIds: [101, 102],
      topics: [
        { id: 1, optimizationTaskId: 101 },
        { id: 2, optimizationTaskId: 99 },
      ],
    });
    expect(gate.ready).toBe(true);
    expect(gate.stage).toBe("ready");
  });

  it("asks for topics when tasks exist but none bound", () => {
    const gate = evaluatePlatformContentDiagnosisGate({
      analysisCount: 9,
      taskIds: [101],
      topics: [],
    });
    expect(gate.ready).toBe(false);
    expect(gate.stage).toBe("no_topics");
    expect(gate.message).toBe(PLATFORM_CONTENT_NO_TOPICS_MESSAGE);
  });
});
