import { describe, expect, it } from "vitest";
import {
  buildT0QuestionGapTagsByQuestionId,
  T0_QUESTION_GAP_TAGS,
} from "./t0QuestionGapTags";

describe("buildT0QuestionGapTagsByQuestionId", () => {
  const questionTypeByQuestionId = new Map<number, string>([
    [1, "行业推荐"],
    [2, "竞品对比"],
    [3, "品牌认知"],
  ]);

  it("tags zero-mention question types as 高优先级缺口", () => {
    const tags = buildT0QuestionGapTagsByQuestionId(
      [
        { questionId: 1, mentionedCompany: false, recommendedCompany: false, competitorMentioned: false },
        { questionId: 1, mentionedCompany: false, recommendedCompany: false, competitorMentioned: false },
      ],
      questionTypeByQuestionId,
      [1, 2],
    );
    expect(tags.get(1)).toContain(T0_QUESTION_GAP_TAGS.highPriorityGap);
  });

  it("tags competitor-without-brand runs as 竞品压制", () => {
    const tags = buildT0QuestionGapTagsByQuestionId(
      [
        { questionId: 2, mentionedCompany: false, recommendedCompany: false, competitorMentioned: true },
        { questionId: 2, mentionedCompany: true, recommendedCompany: true, competitorMentioned: true },
      ],
      questionTypeByQuestionId,
      [2],
    );
    expect(tags.get(2)).toContain(T0_QUESTION_GAP_TAGS.competitorSuppression);
  });

  it("tags recommend rate below 20% as 推荐率不足", () => {
    const tags = buildT0QuestionGapTagsByQuestionId(
      Array.from({ length: 9 }, () => ({
        questionId: 3,
        mentionedCompany: true,
        recommendedCompany: false,
        competitorMentioned: false,
      })).concat({
        questionId: 3,
        mentionedCompany: true,
        recommendedCompany: true,
        competitorMentioned: false,
      }),
      questionTypeByQuestionId,
      [3],
    );
    expect(tags.get(3)).toContain(T0_QUESTION_GAP_TAGS.lowRecommendRate);
    expect(tags.get(3)).not.toContain(T0_QUESTION_GAP_TAGS.highPriorityGap);
  });
});
