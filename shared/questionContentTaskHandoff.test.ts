import { describe, expect, it } from "vitest";
import {
  buildContentProductionListUrl,
  buildQuestionContentTaskUrl,
  selectTopContentTaskCandidates,
} from "./questionContentTaskHandoff";

describe("question content task handoff", () => {
  it("selects up to three unique, enabled Top 3 questions without existing tasks", () => {
    const questions = [
      { id: 1, enabled: 1, hasContentTask: false },
      { id: 2, enabled: 1, hasContentTask: true },
      { id: 3, enabled: 0, hasContentTask: false },
      { id: 4, enabled: 1, hasContentTask: false },
    ];
    expect(
      selectTopContentTaskCandidates([1, 1, 2, 3, 4], questions).map(
        item => item.id
      )
    ).toEqual([1, 4]);
  });

  it("opens the global handoff in the project content-production list without stale ids", () => {
    expect(buildContentProductionListUrl(210001)).toBe(
      "/weekly?mode=content-production&projectId=210001"
    );
    expect(buildContentProductionListUrl(210001)).not.toContain("questionId");
    expect(buildContentProductionListUrl(210001)).not.toContain("taskId");
  });

  it("opens a single question with project-scoped authoritative context", () => {
    expect(buildQuestionContentTaskUrl(210001, 480001)).toBe(
      "/weekly?mode=content-production&projectId=210001&questionId=480001&sourceType=optimization_task"
    );
  });
});
