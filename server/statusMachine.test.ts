import { describe, expect, it } from "vitest";
import { resolveForwardProjectStatus } from "./routers";

describe("resolveForwardProjectStatus", () => {
  it("allows the lightweight harness to move forward", () => {
    expect(resolveForwardProjectStatus("score_done", "tasks_ready")).toBe("tasks_ready");
    expect(resolveForwardProjectStatus("tasks_ready", "report_ready")).toBe("report_ready");
  });

  it("prevents completed projects from regressing to an earlier step", () => {
    expect(resolveForwardProjectStatus("report_ready", "score_done")).toBe("report_ready");
    expect(resolveForwardProjectStatus("tasks_ready", "analysis_done")).toBe("tasks_ready");
  });

  it("initializes empty historical status with the requested status", () => {
    expect(resolveForwardProjectStatus(null, "created")).toBe("created");
    expect(resolveForwardProjectStatus(undefined, "questions_ready")).toBe("questions_ready");
  });
});
