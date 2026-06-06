import { describe, expect, it } from "vitest";
import { isContentTaskIdInProjectTaskList } from "./geoProjectScopedContentTask";

describe("geoProjectScopedContentTask", () => {
  it("project A task ids do not match project B task list", () => {
    const projectATasks = [{ id: 101 }, { id: 102 }];
    const projectBTaskId = 201;
    expect(isContentTaskIdInProjectTaskList(projectBTaskId, projectATasks)).toBe(false);
    expect(isContentTaskIdInProjectTaskList(101, projectATasks)).toBe(true);
  });

  it("rejects invalid contentTaskId", () => {
    expect(isContentTaskIdInProjectTaskList(null, [{ id: 1 }])).toBe(false);
    expect(isContentTaskIdInProjectTaskList(0, [{ id: 1 }])).toBe(false);
  });
});
