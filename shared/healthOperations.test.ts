import { describe, expect, it } from "vitest";
import {
  evaluateLastContentGeneration,
  evaluateLastPublish,
  isPublishQueueActiveStatus,
} from "./healthOperations";

describe("healthOperations", () => {
  it("detects active publish queue statuses", () => {
    expect(isPublishQueueActiveStatus("pending_agent")).toBe(true);
    expect(isPublishQueueActiveStatus("completed")).toBe(false);
    expect(isPublishQueueActiveStatus("failed")).toBe(false);
  });

  it("evaluates last content generation", () => {
    expect(evaluateLastContentGeneration(null).ok).toBe(false);
    expect(
      evaluateLastContentGeneration({
        markdownContent: "x".repeat(60),
        createdAt: "2026-06-01T08:00:00.000Z",
      }).ok,
    ).toBe(true);
    expect(
      evaluateLastContentGeneration({
        markdownContent: "短",
        createdAt: "2026-06-01T08:00:00.000Z",
      }).ok,
    ).toBe(false);
  });

  it("evaluates last publish terminal states", () => {
    expect(
      evaluateLastPublish({
        status: "completed",
        updatedAt: "2026-06-01T09:00:00.000Z",
      }).ok,
    ).toBe(true);
    expect(
      evaluateLastPublish({
        status: "failed",
        updatedAt: "2026-06-01T09:00:00.000Z",
        errorMessage: "timeout",
      }).ok,
    ).toBe(false);
    expect(
      evaluateLastPublish({
        status: "pending_agent",
        updatedAt: "2026-06-01T09:00:00.000Z",
      }).message,
    ).toContain("发布未完成");
  });
});
