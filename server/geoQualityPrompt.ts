export type QualityReviewContentInput = {
  title: string;
  body: string;
  brandName: string;
  targetQuestion: string;
  contentType: string;
};

const SYSTEM_PROMPT = `你是一个 GEO 内容质量审核专家。GEO（Generative Engine Optimization）的目标是让内容容易被 AI 平台（豆包、DeepSeek、Kimi 等）识别、理解、收录和引用。你需要从 GEO 视角而非传统 SEO 或文采视角来评分。`;

export function buildQualityReviewPrompt(content: QualityReviewContentInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const userPrompt = `请对以下文章进行 GEO 内容质量评分。

【品牌名】${content.brandName}
【目标问题】${content.targetQuestion}
【内容类型】${content.contentType}
【文章标题】${content.title}

【文章正文】
${content.body}

请严格按以下 6 个维度评分（满分合计 100），并只输出一个 JSON 对象，不要在 JSON 外输出任何文字：

1. brand_entity（满分 20）：品牌名是否多次出现，是否解释品牌是做什么的，品牌实体信号是否足够强。
2. question_match（满分 20）：内容是否真实回答目标问题，用户搜索这个问题能否在文章中找到明确答案。
3. ai_citable_structure（满分 20）：是否有结论句、要点、定义、可被 AI 直接摘取的段落，是否避免空话套话。
4. case_evidence（满分 15）：是否有具体案例、数据、客户故事、可信证明。
5. competitor_comparison（满分 15）：是否提到竞品或替代方案，是否解释为什么选择本品牌而不是其他方案。
6. platform_friendly（满分 10）：结构是否清晰，标题是否规范，是否适合知乎、百家号、头条、搜狐等平台收录。

recommendation 规则（你必须遵守，可与分项加总后自行校验）：
- total >= 80 → publish
- 60 <= total < 80 → revise
- total < 60 → reject

JSON 格式（字段名必须一致）：
{
  "scores": {
    "brand_entity": { "score": 0-20, "reason": "..." },
    "question_match": { "score": 0-20, "reason": "..." },
    "ai_citable_structure": { "score": 0-20, "reason": "..." },
    "case_evidence": { "score": 0-15, "reason": "..." },
    "competitor_comparison": { "score": 0-15, "reason": "..." },
    "platform_friendly": { "score": 0-10, "reason": "..." }
  },
  "total": 0-100,
  "recommendation": "publish" | "revise" | "reject",
  "suggestions": ["建议1", "建议2", "建议3"]
}`;

  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}
