import { invokeLLM } from "./_core/llm";
import {
  GEO_T0_QUESTION_BANK_TYPES,
  GEO_T0_QUESTIONS_PER_TYPE_MIN,
  GEO_T0_QUESTIONS_TOTAL_MIN,
  GEO_T0_QUESTIONS_TOTAL_TARGET,
  type GeoT0QuestionBankType,
} from "@shared/geoQuestionBankTypes";

export type GeoQuestionBankPromptInput = {
  brandName: string;
  industryTag: string;
  productDesc: string;
  targetCustomer: string;
  customerPains: string;
  competitors: string;
  keyPoints: string;
  coreKeywords?: string[];
};

export type GeneratedGeoQuestionBankRow = {
  questionText: string;
  questionType: GeoT0QuestionBankType;
};

export const GEO_QUESTION_BANK_SYSTEM_PROMPT = `你是 GEO（AI 搜索可见性）诊断专家，负责生成「用户会直接问 AI 助手」的自然语言问题。
这些问题将用于 AI 现状检测：向多个 AI 平台提问，观察 AI 是否提及、推荐目标品牌。

总目标：生成 ${GEO_T0_QUESTIONS_TOTAL_TARGET} 条左右、真实可检索的中文问题，覆盖以下 5 类，每类至少 ${GEO_T0_QUESTIONS_PER_TYPE_MIN} 条。

## 五类问题写法（必须严格遵守句式模式）

1. 品牌认知（questionType: 品牌认知）
   - 直接考察 AI 对品牌的认知，必须包含企业品牌名
   - 句式示例：「{品牌}是什么？」「{品牌}是做什么的？」「{品牌}主要提供什么产品/服务？」
   - 不要用第三人称绕弯，不要写成广告语

2. 行业推荐（questionType: 行业推荐）
   - 考察 AI 在行业语境下的推荐列表，问题中不出现本品牌名
   - 句式示例：「{行业}领域最好的工具/平台有哪些？」「做{行业}一般选什么软件？」「{行业}有哪些靠谱的服务商？」

3. 竞品对比（questionType: 竞品对比）
   - 考察 AI 在对比语境下如何评价本品牌与竞品，必须同时出现本品牌名与至少一个竞品名
   - 句式示例：「{品牌}和{竞品A}哪个更好？」「{品牌}与{竞品B}怎么选？」
   - 若档案未提供竞品，用同行业常见替代方案名（勿编造与本品牌无关的虚构公司）

4. 场景需求（questionType: scenario_need）
   - 用户带着具体业务场景求推荐，问题中不出现本品牌名
   - 句式示例：「我需要{具体场景/目标}，有什么工具推荐？」「{目标客户}想{达成目标}，用什么方案比较好？」

5. 长尾转化（questionType: long_tail_conversion）
   - 更细的使用场景、实施细节或决策后期问题，可含品牌名也可不含，但要具体
   - 句式示例：「{品牌}适合{细分场景}吗？」「{目标客户}在{具体环节}上怎么用{品类}工具？」

## 质量要求
- 每条 15–45 字，口语化、像真人会问 AI 的话
- 同类型内角度要分散（认知/对比/场景/价格/实施等），禁止仅替换一两个词的重复句
- 禁止空泛套话（如「介绍一下这个行业」）
- 禁止「XX 平台怎么样」式无场景评测
- 只输出符合 JSON Schema 的单个 JSON 对象`;

export function buildGeoQuestionBankUserPrompt(input: GeoQuestionBankPromptInput): string {
  const keywords =
    input.coreKeywords && input.coreKeywords.length > 0
      ? input.coreKeywords.join("、")
      : "（未填）";
  return [
    "企业档案：",
    `- 品牌名称：${input.brandName}`,
    `- 行业：${input.industryTag}`,
    `- 产品/服务：${input.productDesc}`,
    `- 目标客户：${input.targetCustomer}`,
    `- 客户痛点：${input.customerPains}`,
    `- 核心卖点：${input.keyPoints}`,
    `- 竞品：${input.competitors}`,
    `- 核心关键词：${keywords}`,
    "",
    `请生成至少 ${GEO_T0_QUESTIONS_TOTAL_MIN} 条问题（建议 ${GEO_T0_QUESTIONS_TOTAL_TARGET} 条），五类各至少 ${GEO_T0_QUESTIONS_PER_TYPE_MIN} 条。`,
    "将结果放在根对象 questions 数组中，每项含 questionText、questionType。",
  ].join("\n");
}

export function countQuestionsByT0Type(
  rows: Array<{ questionType: string }>,
): Record<GeoT0QuestionBankType, number> {
  const counts = Object.fromEntries(
    GEO_T0_QUESTION_BANK_TYPES.map(t => [t, 0]),
  ) as Record<GeoT0QuestionBankType, number>;
  for (const row of rows) {
    if ((GEO_T0_QUESTION_BANK_TYPES as readonly string[]).includes(row.questionType)) {
      counts[row.questionType as GeoT0QuestionBankType] += 1;
    }
  }
  return counts;
}

export function validateT0QuestionBankRows(rows: GeneratedGeoQuestionBankRow[]): {
  ok: boolean;
  message?: string;
  byType: Record<GeoT0QuestionBankType, number>;
} {
  const byType = countQuestionsByT0Type(rows);
  if (rows.length < GEO_T0_QUESTIONS_TOTAL_MIN) {
    return {
      ok: false,
      message: `有效问题不足 ${GEO_T0_QUESTIONS_TOTAL_MIN} 条（当前 ${rows.length} 条）`,
      byType,
    };
  }
  for (const type of GEO_T0_QUESTION_BANK_TYPES) {
    if (byType[type] < GEO_T0_QUESTIONS_PER_TYPE_MIN) {
      return {
        ok: false,
        message: `「${type}」类问题不足 ${GEO_T0_QUESTIONS_PER_TYPE_MIN} 条（当前 ${byType[type]} 条）`,
        byType,
      };
    }
  }
  return { ok: true, byType };
}

function parseLlmJsonObject<T>(content: unknown): T {
  if (typeof content !== "string") throw new Error("AI 返回格式不是文本 JSON");
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error("AI 返回 JSON 解析失败");
  }
}

export async function generateT0QuestionBank(
  input: GeoQuestionBankPromptInput,
): Promise<{ rows: GeneratedGeoQuestionBankRow[]; byType: Record<GeoT0QuestionBankType, number> }> {
  const response = await invokeLLM({
    max_tokens: 8192,
    timeout_ms: 120000,
    messages: [
      { role: "system", content: GEO_QUESTION_BANK_SYSTEM_PROMPT },
      { role: "user", content: buildGeoQuestionBankUserPrompt(input) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "geo_t0_question_bank",
        strict: true,
        schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              minItems: GEO_T0_QUESTIONS_TOTAL_MIN,
              maxItems: 30,
              items: {
                type: "object",
                properties: {
                  questionText: { type: "string" },
                  questionType: { type: "string", enum: [...GEO_T0_QUESTION_BANK_TYPES] },
                },
                required: ["questionText", "questionType"],
                additionalProperties: false,
              },
            },
          },
          required: ["questions"],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = parseLlmJsonObject<{
    questions: Array<{ questionText: string; questionType: string }>;
  }>(response.choices[0]?.message.content);

  const allowed = new Set<string>(GEO_T0_QUESTION_BANK_TYPES);
  const seen = new Set<string>();
  const rows: GeneratedGeoQuestionBankRow[] = [];
  for (const item of parsed.questions ?? []) {
    const questionText = typeof item.questionText === "string" ? item.questionText.trim() : "";
    const questionType = typeof item.questionType === "string" ? item.questionType.trim() : "";
    if (!questionText || questionText.length > 80) continue;
    if (!allowed.has(questionType)) continue;
    if (seen.has(questionText)) continue;
    seen.add(questionText);
    rows.push({
      questionText,
      questionType: questionType as GeoT0QuestionBankType,
    });
  }

  const validation = validateT0QuestionBankRows(rows);
  if (!validation.ok) {
    throw new Error(validation.message ?? "问题库分布未达标，请重试");
  }
  return { rows, byType: validation.byType };
}
