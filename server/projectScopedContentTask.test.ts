import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";
import { PROJECT_SCOPED_CONTENT_TASK_MISMATCH_MESSAGE } from "@shared/geoProjectScopedContentTask";
import { assertProjectScopedContentTask } from "./projectScopedContentTask";
import type { TrpcContext } from "./_core/context";

const ctx = {
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
  user: {
    id: 1,
    openId: "test",
    name: "Test",
    email: null,
    loginMethod: "test",
    role: "admin",
    extensionApiKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
};

vi.mock("./projectAccess", () => ({
  requireProjectAccess: vi.fn(async () => ({ id: 1, enterpriseName: "A" })),
}));

describe("assertProjectScopedContentTask", () => {
  it("throws when contentTaskId is not in project", async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    };
    await expect(
      assertProjectScopedContentTask(db as never, ctx, { projectId: 1, contentTaskId: 99 }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: PROJECT_SCOPED_CONTENT_TASK_MISMATCH_MESSAGE,
    });
  });

  it("passes when task row exists for project", async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: 99 }],
          }),
        }),
      }),
    };
    await expect(
      assertProjectScopedContentTask(db as never, ctx, { projectId: 1, contentTaskId: 99 }),
    ).resolves.toBeUndefined();
  });
});
