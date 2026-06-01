/** T0 基线检测问题库五类（与 drizzle questionType 枚举一致） */
export const GEO_T0_QUESTION_BANK_TYPES = [
  "品牌认知",
  "行业推荐",
  "竞品对比",
  "scenario_need",
  "long_tail_conversion",
] as const;

export type GeoT0QuestionBankType = (typeof GEO_T0_QUESTION_BANK_TYPES)[number];

export const GEO_T0_QUESTIONS_PER_TYPE_MIN = 4;
export const GEO_T0_QUESTIONS_TOTAL_MIN = 20;
export const GEO_T0_QUESTIONS_TOTAL_TARGET = 24;

export const GEO_T0_QUESTION_BANK_TYPE_LABELS: Record<GeoT0QuestionBankType, string> = {
  品牌认知: "品牌认知",
  行业推荐: "行业推荐",
  竞品对比: "竞品对比",
  scenario_need: "场景需求",
  long_tail_conversion: "长尾转化",
};
