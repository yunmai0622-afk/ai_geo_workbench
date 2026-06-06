import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("GEO-V1.1-T0-Gap-Auto-Tag", () => {
  it("computes gap tags from ai_test_runs and applies after T0 completes", () => {
    expect(read("shared/t0QuestionGapTags.ts")).toContain("buildT0QuestionGapTagsByQuestionId");
    expect(read("shared/t0QuestionGapTags.ts")).toContain("高优先级缺口");
    expect(read("shared/t0QuestionGapTags.ts")).toContain("竞品压制");
    expect(read("shared/t0QuestionGapTags.ts")).toContain("推荐率不足");
    expect(read("server/t0QuestionGapTags.ts")).toContain("applyT0QuestionGapTagsForRound");
    expect(read("server/geoT0Executor.ts")).toContain("applyT0QuestionGapTagsForRound");
  });

  it("persists contentGapTags on questions and shows on library page", () => {
    expect(read("drizzle/schema.ts")).toContain("contentGapTags");
    const library = read("client/src/pages/QuestionsLibraryPage.tsx");
    expect(library).toContain("contentGapTags");
    expect(library).toContain("T0_QUESTION_GAP_TAGS");
  });
});
