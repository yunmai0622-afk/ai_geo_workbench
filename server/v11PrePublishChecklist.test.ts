import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Pre-Publish-Checklist", () => {
  it("shared module defines five publish checks", () => {
    const mod = read("shared/publishPrePublishChecklist.ts");
    expect(mod).toContain("title_within_limit");
    expect(mod).toContain("body_min_length");
    expect(mod).toContain("has_cover");
    expect(mod).toContain("account_valid");
    expect(mod).toContain("quality_passed");
    expect(mod).toContain("evaluatePrePublishChecklist");
  });

  it("weekly publish dialog shows checklist and blocks confirm", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    const panel = read("client/src/components/publishing/PublishPrePublishChecklist.tsx");
    expect(weekly).toContain("PublishPrePublishChecklist");
    expect(panel).toContain("publish-pre-checklist");
    expect(weekly).toContain("activePrePublishChecklist");
    expect(weekly).toContain("formatPrePublishChecklistBlockMessage");
  });

  it("publishTasks.create enforces checklist server-side", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("assertPrePublishChecklistForCreate");
    expect(router).toContain("formatPrePublishChecklistBlockMessage");
  });
});
