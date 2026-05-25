import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ARTICLE_LIFECYCLE_STATUSES,
  isFakePublishedLifecycle,
  resolveArticleLifecycleView,
} from "@shared/articleLifecycle";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-P0-B — 文章生命周期", () => {
  it("defines all lifecycle statuses", () => {
    expect(ARTICLE_LIFECYCLE_STATUSES).toHaveLength(10);
    expect(ARTICLE_LIFECYCLE_STATUSES).toContain("manual_required");
    expect(ARTICLE_LIFECYCLE_STATUSES).toContain("failed");
  });

  it("flags fake published without publicPath", () => {
    expect(
      isFakePublishedLifecycle({
        lifecycleStatus: "published",
        publicPath: null,
      }),
    ).toBe(true);
    expect(
      isFakePublishedLifecycle({
        lifecycleStatus: "published",
        publicPath: "https://zhuanlan.zhihu.com/p/1",
      }),
    ).toBe(false);
  });

  it("does not treat manual_required as published in view", () => {
    const view = resolveArticleLifecycleView({
      lifecycleStatus: "manual_required",
      lifecycleEvents: [
        {
          status: "manual_required",
          at: "2026-05-22T10:00:00.000Z",
          source: "agent_report",
          message: "需在平台确认保存",
        },
      ],
      status: "审核通过",
      publicPath: null,
    });
    expect(view.status).toBe("manual_required");
    expect(view.label).toBe("需人工确认保存");
    expect(view.fakePublished).toBe(false);
  });

  it("wires lifecycle through routers and publish flow", () => {
    expect(read("server/routers.ts")).toContain("appendArticleLifecycleEvent");
    expect(read("server/routers.ts")).toContain('status: "generated"');
    expect(read("server/routers.ts")).toContain('status: "confirmed"');
    expect(read("server/geoArticleQualityCheckFlow.ts")).toContain("quality_checked");
    expect(read("server/publishTasksRouter.ts")).toContain("pending_publish");
  });
});
