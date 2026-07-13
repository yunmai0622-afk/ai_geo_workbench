import { describe, expect, it } from "vitest";
import {
  CONTENT_GENERATION_FAILED_EDIT_REASON,
  CONTENT_NOT_GENERATED_EDIT_REASON,
  hasEditableArticleBody,
  resolveArticleContentEditState,
} from "./contentEditState";
import { PLATFORM_DRAFT_PLACEHOLDER_MARKDOWN } from "./platformDraftGeneration";

describe("contentEditState", () => {
  it("blocks editing for queued or generating platform drafts", () => {
    const state = resolveArticleContentEditState({
      status: "待生成",
      markdownContent: PLATFORM_DRAFT_PLACEHOLDER_MARKDOWN,
      generationBasis: {
        platformDraftGeneration: { status: "generating" },
      },
    });
    expect(state.editable).toBe(false);
    expect(state.state).toBe("generating");
    expect(state.reason).toBe(CONTENT_NOT_GENERATED_EDIT_REASON);
    expect(
      hasEditableArticleBody({
        status: "待生成",
        markdownContent: PLATFORM_DRAFT_PLACEHOLDER_MARKDOWN,
      }),
    ).toBe(false);
  });

  it("blocks editing for failed platform drafts instead of treating them as quality revisions", () => {
    const state = resolveArticleContentEditState({
      status: "待生成",
      markdownContent: PLATFORM_DRAFT_PLACEHOLDER_MARKDOWN,
      generationBasis: {
        platformDraftGeneration: { status: "failed" },
      },
    });
    expect(state.editable).toBe(false);
    expect(state.state).toBe("failed");
    expect(state.reason).toBe(CONTENT_GENERATION_FAILED_EDIT_REASON);
  });

  it("allows editing when a quality-failed article has a real body", () => {
    const state = resolveArticleContentEditState({
      status: "质检未通过",
      markdownContent: "# 标题\n\n真实正文",
      generationBasis: {
        platformDraftGeneration: { status: "generated" },
      },
    });
    expect(state.editable).toBe(true);
    expect(state.body).toContain("真实正文");
  });
});
