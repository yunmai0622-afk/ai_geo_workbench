import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

function createBlock() {
  const router = read("server/publishTasksRouter.ts");
  const start = router.indexOf("create: protectedProcedure");
  const end = router.indexOf("reviewAndEnqueueArticle:", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return router.slice(start, end);
}

describe("GEO-V2.3 publishTasks.create 500 fix", () => {
  it("keeps quality, human review, account and project validations before creating task", () => {
    const block = createBlock();
    const checks = [
      "article.projectId !== input.projectId",
      "assertPublishReadinessForCreate",
      "assertContentReviewReadyForCreate",
      "resolvePublishPlatformAccount",
      "assertPrePublishChecklistForCreate",
      "assertNoDuplicatePublishQueueTask",
    ];
    const insert = block.indexOf("insertPublishTaskRecord");
    expect(insert).toBeGreaterThan(-1);
    for (const check of checks) {
      expect(block).toContain(check);
      expect(block.indexOf(check)).toBeLessThan(insert);
    }
  });

  it("blocks content that has not passed quality preflight", () => {
    const router = read("server/publishTasksRouter.ts");
    const readiness = router.slice(
      router.indexOf("async function assertPublishReadinessForCreate"),
      router.indexOf("function assertContentReviewReadyForCreate"),
    );
    expect(readiness).toContain('"QUALITY_PASSED"');
    expect(readiness).toContain("formatPublishPreflightBlockMessage");
    expect(readiness).toContain("发布前检查未通过");
  });

  it("blocks content that has not passed manual review", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("normalizeContentReviewStatus(article.contentReviewStatus)");
    expect(router).toContain('"已审核可发布"');
    expect(router).toContain("该内容尚未完成人工审核确认");
  });

  it("keeps project isolation before resolving accounts or inserting tasks", () => {
    const block = createBlock();
    const projectGuard = block.indexOf("article.projectId !== input.projectId");
    const accessGuard = block.indexOf("requireProjectAccessConn");
    const accountLookup = block.indexOf("resolvePublishPlatformAccount");
    const insert = block.indexOf("insertPublishTaskRecord");
    expect(projectGuard).toBeGreaterThan(-1);
    expect(accessGuard).toBeGreaterThan(projectGuard);
    expect(accountLookup).toBeGreaterThan(accessGuard);
    expect(insert).toBeGreaterThan(accountLookup);
  });

  it("creates pending agent tasks only, not published tasks", () => {
    const router = read("server/publishTasksRouter.ts");
    const insert = router.slice(router.indexOf("async function insertPublishTaskRecord"));
    expect(insert).toContain('status: "pending_agent"');
    expect(insert).not.toContain('status: "published"');
    expect(insert).not.toContain('status: "已发布"');
  });

  it("uses DB-safe cover payload for publish task insertion", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("buildPublishTaskCoverImageUrl");
    expect(router).toContain("cover payload too large");
    const cover = read("shared/publishCoverPayload.ts");
    expect(cover).toContain("PUBLISH_TASK_COVER_IMAGE_URL_MAX_CHARS");
    expect(cover).toContain("fallbackCoverBase64");
  });

  it("does not turn post-create article sync failures into publishTasks.create 500", () => {
    const insert = read("server/publishTasksRouter.ts").slice(
      read("server/publishTasksRouter.ts").indexOf("async function insertPublishTaskRecord"),
      read("server/publishTasksRouter.ts").indexOf("async function attachCoverImagePayload"),
    );
    expect(insert).toContain("publish task created but article lifecycle sync failed");
    expect(insert).toContain("publish task will continue without persisted article coverBase64");
    expect(insert).toContain("logPublishTaskCreateWarning");
    expect(insert).not.toContain('throw err;\n  }\n\n  return {\n    taskId');
  });
});
