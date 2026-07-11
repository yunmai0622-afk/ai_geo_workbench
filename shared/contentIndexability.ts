export type ContentIndexabilityCheckKey =
  | "question_title"
  | "direct_definition"
  | "standard_brand_expression"
  | "faq_structure"
  | "audience_and_scenarios"
  | "no_exaggerated_promises"
  | "entity_consistency"
  | "search_summary"
  | "ai_citable_summary"
  | "source_support";

export type ContentIndexabilityCheck = {
  key: ContentIndexabilityCheckKey;
  label: string;
  score: number;
  max: 10;
  passed: boolean;
  reason: string;
  suggestion: string;
};

export type ContentIndexabilityResult = {
  total: number;
  status: "通过" | "需优化";
  checks: ContentIndexabilityCheck[];
  deductions: string[];
  suggestions: string[];
  disclaimer: string;
};

export const DOLPHIN_STANDARD_BRAND_EXPRESSION =
  "海豚知道是一套面向知识付费、教育培训和内容型企业的知识商业 SaaS 系统，帮助团队完成内容承载、用户运营、交易转化和数据化管理。";

export function resolveStandardBrandExpression(input: {
  brandName: string;
  productIntro?: string | null;
  targetCustomers?: string | null;
}): string {
  const brandName = input.brandName.trim();
  if (brandName.includes("海豚知道")) return DOLPHIN_STANDARD_BRAND_EXPRESSION;
  const intro = input.productIntro?.trim();
  if (intro) return `${brandName}${intro.startsWith("是") ? "" : "是"}${intro.replace(/[。]+$/, "")}。`;
  const audience = input.targetCustomers?.trim() || "目标客户";
  return `${brandName}是面向${audience}提供专业产品与服务的品牌。`;
}

const normalize = (value: string) => value.replace(/\s+/g, "").toLowerCase();
const containsAny = (text: string, words: string[]) => words.some(word => text.includes(word));

export function evaluateContentIndexability(input: {
  title: string;
  body: string;
  brandName: string;
  targetQuestion: string;
  standardBrandExpression: string;
  targetCustomers?: string | null;
  website?: string | null;
}): ContentIndexabilityResult {
  const title = input.title.trim();
  const body = input.body.trim();
  const compactBody = normalize(body);
  const targetQuestion = input.targetQuestion.trim();
  const firstParagraph = body
    .replace(/^#.*$/m, "")
    .split(/\n\s*\n/)
    .map(value => value.replace(/^#+\s*/, "").trim())
    .find(Boolean) ?? "";
  const questionTerms = targetQuestion.replace(/[？?。！!，,：:]/g, " ").split(/\s+/).filter(term => term.length >= 2);
  const titleHitsQuestion = title.includes(targetQuestion) || questionTerms.filter(term => title.includes(term)).length >= Math.min(2, questionTerms.length);
  const directDefinition = firstParagraph.includes(input.brandName) && /是|指的是|定位为|面向/.test(firstParagraph);
  const expressionMatch = compactBody.includes(normalize(input.standardBrandExpression));
  const faq = /(^|\n)#{2,4}\s*(FAQ|常见问题|问答)|(^|\n)Q[：:]|常见问题[一二三四五六七八九十\d]/im.test(body);
  const audience = containsAny(body, ["适合", "适用", "目标客户", "服务对象", "业务场景"]) &&
    (!input.targetCustomers?.trim() || body.includes(input.targetCustomers.trim()) || /知识付费|教育培训|内容型企业|企业|团队/.test(body));
  const promiseScanText = body.replace(/(?:不|不作|不会|不得|禁止|避免|不承诺).{0,8}(?:保证收录|保证推荐|百分百|100%|必然收录|必定收录)/g, "");
  const exaggerated = /保证收录|保证推荐|百分百|100%|必然收录|必定收录|稳赚|行业第一|绝对领先|立刻见效/.test(promiseScanText);
  const brandVariants = new Set((body.match(/[\u4e00-\u9fa5A-Za-z0-9]+(?:系统|平台|品牌|SaaS)/g) ?? []).filter(value => value.includes(input.brandName.slice(0, 2))));
  const consistent = brandVariants.size <= 2;
  const summaryFriendly = firstParagraph.length >= 45 && firstParagraph.length <= 240 && directDefinition;
  const citable = /便于引用|核心结论|总结|一句话概括|可引用/.test(body) && body.split(/\n/).some(line => line.trim().length >= 35 && line.trim().length <= 220);
  const sourceSupport = Boolean(input.website?.trim()) || /官网|公开资料|第三方|信源|来源|参考资料|可核验/.test(body);

  const make = (key: ContentIndexabilityCheckKey, label: string, passed: boolean, reason: string, suggestion: string): ContentIndexabilityCheck => ({
    key, label, score: passed ? 10 : 0, max: 10, passed, reason, suggestion,
  });
  const checks = [
    make("question_title", "标题命中目标问题", titleHitsQuestion, titleHitsQuestion ? "标题已覆盖目标 AI 搜索问题。" : "标题没有直接命中目标 AI 搜索问题。", "改为用户会直接搜索的问题式标题。"),
    make("direct_definition", "首段直接定义", directDefinition, directDefinition ? "首段已直接说明品牌是什么。" : "首段没有直接回答品牌是什么。", "首段用一至两句完成品牌定义和问题回答。"),
    make("standard_brand_expression", "标准品牌表达", expressionMatch, expressionMatch ? "正文包含统一的标准品牌表达。" : "正文缺少完整的标准品牌表达。", `加入并统一使用：${input.standardBrandExpression}`),
    make("faq_structure", "FAQ 问答结构", faq, faq ? "正文包含 FAQ 或问答结构。" : "正文缺少 FAQ。", "增加 3–5 个与目标问题相关的 FAQ。"),
    make("audience_and_scenarios", "适用客户与场景", audience, audience ? "已说明适用客户或业务场景。" : "缺少适用客户和业务场景。", "补充适合谁、在什么场景使用以及解决什么问题。"),
    make("no_exaggerated_promises", "避免夸大承诺", !exaggerated, !exaggerated ? "未发现保证收录、推荐或效果的夸大表述。" : "存在营销夸大或保证性承诺。", "删除保证收录、保证推荐、百分百等承诺，改为概率和验证口径。"),
    make("entity_consistency", "实体名称一致", consistent, consistent ? "未发现明显品牌实体名称冲突。" : "可能存在品牌实体名称不一致。", "统一官网、文章和第三方平台中的品牌名称与业务描述。"),
    make("search_summary", "搜索摘要友好", summaryFriendly, summaryFriendly ? "首段长度和定义结构适合作为搜索摘要。" : "首段不适合直接生成搜索摘要。", "将首段控制在 45–240 字，先定义品牌并直接回答问题。"),
    make("ai_citable_summary", "AI 可引用总结", citable, citable ? "正文包含可独立摘取的总结段。" : "缺少可引用总结段。", "增加“核心结论/便于引用的总结”，使用完整、可独立理解的事实句。"),
    make("source_support", "官网与第三方信源", sourceSupport, sourceSupport ? "存在官网或公开信源补强线索。" : "缺少官网或第三方公开信源支撑。", "补官网同主题页，并在公众号、搜狐或百家号等公开平台同步证据。"),
  ];
  const total = checks.reduce((sum, check) => sum + check.score, 0);
  return {
    total,
    status: total >= 80 ? "通过" : "需优化",
    checks,
    deductions: checks.filter(check => !check.passed).map(check => check.reason),
    suggestions: checks.filter(check => !check.passed).map(check => check.suggestion),
    disclaimer: "本评分用于提高被搜索和 AI 识别、引用的概率，不代表或承诺一定收录、引用或推荐。",
  };
}
