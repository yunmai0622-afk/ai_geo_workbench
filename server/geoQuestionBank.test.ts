import { describe, expect, it } from "vitest";
import {
  buildGeoQuestionBankUserPrompt,
  countQuestionsByT0Type,
  validateT0QuestionBankRows,
  type GeneratedGeoQuestionBankRow,
} from "./geoQuestionBank";

function mockRows(counts: Record<string, number>): GeneratedGeoQuestionBankRow[] {
  const rows: GeneratedGeoQuestionBankRow[] = [];
  for (const [questionType, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) {
      rows.push({
        questionText: `${questionType}样例问题${i + 1}`,
        questionType: questionType as GeneratedGeoQuestionBankRow["questionType"],
      });
    }
  }
  return rows;
}

describe("geoQuestionBank", () => {
  it("user prompt 包含品牌与五类分布要求", () => {
    const text = buildGeoQuestionBankUserPrompt({
      brandName: "海豚知道",
      industryTag: "知识付费",
      productDesc: "课程售卖系统",
      targetCustomer: "知识博主",
      customerPains: "转化低",
      competitors: "小鹅通",
      keyPoints: "私域转化",
    });
    expect(text).toContain("海豚知道");
    expect(text).toContain("至少 20 条");
    expect(text).toContain("五类各至少 4 条");
  });

  it("校验每类至少 4 条、总计至少 20 条", () => {
    const ok = validateT0QuestionBankRows(
      mockRows({
        品牌认知: 4,
        行业推荐: 4,
        竞品对比: 4,
        scenario_need: 4,
        long_tail_conversion: 4,
      }),
    );
    expect(ok.ok).toBe(true);
    expect(ok.byType?.品牌认知).toBe(4);
    expect(countQuestionsByT0Type(mockRows({ 品牌认知: 1, 行业推荐: 2 }))).toEqual(
      expect.objectContaining({ 品牌认知: 1, 行业推荐: 2 }),
    );
  });

  it("某一类不足时校验失败", () => {
    const bad = validateT0QuestionBankRows(
      mockRows({
        品牌认知: 5,
        行业推荐: 5,
        竞品对比: 5,
        scenario_need: 5,
        long_tail_conversion: 3,
      }),
    );
    expect(bad.ok).toBe(false);
    expect(bad.message).toContain("long_tail_conversion");
  });
});
