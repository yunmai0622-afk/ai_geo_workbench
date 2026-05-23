import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { ENTERPRISE_INDUSTRY_OPTIONS } from "@shared/enterpriseProfileIndustry";

export const enterpriseProfileAnalyzeInputSchema = z.object({
  projectId: z.number().int().positive(),
  documentText: z.string().min(20, "资料内容过短，请补充后重试").max(50000, "资料内容过长，请分段上传"),
});

const emptyToNull = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t.length > 0 ? t : null;
};

export const enterpriseProfileAnalysisSchema = z.object({
  brandName: z.preprocess(emptyToNull, z.string().nullable()),
  industry: z.preprocess(emptyToNull, z.string().nullable()),
  customIndustry: z.preprocess(emptyToNull, z.string().nullable()),
  businessSummary: z.preprocess(emptyToNull, z.string().nullable()),
  mainPlatforms: z.preprocess(emptyToNull, z.string().nullable()),
  targetCustomers: z.preprocess(emptyToNull, z.string().nullable()),
  customerPainPoints: z.array(z.string()).default([]),
  competitors: z.array(z.string()).default([]),
  caseSummary: z.preprocess(emptyToNull, z.string().nullable()),
  caseActions: z.preprocess(emptyToNull, z.string().nullable()),
  caseResults: z.preprocess(emptyToNull, z.string().nullable()),
  confidenceNotes: z.array(z.string()).default([]),
});

export type EnterpriseProfileAnalysis = z.infer<typeof enterpriseProfileAnalysisSchema>;

const SYSTEM_PROMPT = `你是企业资料结构化提取助手。只从用户提供的资料原文中提取信息，输出严格 JSON。

规则：
1. 不确定的字段必须返回 null（数组字段无证据则返回空数组 []）
2. 禁止编造客户案例、结果数据、价格承诺
3. 案例相关字段：仅当资料中有明确案例描述时才填写，否则 caseSummary/caseActions/caseResults 均为 null
4. industry 必须从给定行业选项中选择；无法匹配时选「其他」，并将具体行业写入 customIndustry
5. customerPainPoints 须结合行业与资料，最多 8 条，每条不超过 24 字
6. competitors 仅提取资料中明确提及的竞品/对比品牌，不要猜测
7. confidenceNotes 用简短中文说明识别依据或不确定点（1-4 条）
8. 不要输出任何非 schema 规定的额外字段`;

function parseAnalysisJson(content: unknown): EnterpriseProfileAnalysis {
  if (typeof content !== "string") throw new Error("AI 返回格式异常，请稍后重试");
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("AI 返回解析失败，请稍后重试");
  }
  const parsed = enterpriseProfileAnalysisSchema.safeParse(raw);
  if (!parsed.success) throw new Error("AI 返回结构不完整，请稍后重试");
  return parsed.data;
}

function normalizeIndustry(industry: string | null, customIndustry: string | null): {
  industry: string | null;
  customIndustry: string | null;
} {
  if (!industry?.trim()) return { industry: null, customIndustry: customIndustry?.trim() || null };
  const t = industry.trim();
  if ((ENTERPRISE_INDUSTRY_OPTIONS as readonly string[]).includes(t)) {
    return { industry: t, customIndustry: t === "其他" ? customIndustry?.trim() || null : null };
  }
  return { industry: "其他", customIndustry: t };
}

export async function analyzeEnterpriseProfileDocument(documentText: string): Promise<EnterpriseProfileAnalysis> {
  const trimmed = documentText.trim();
  const industryList = ENTERPRISE_INDUSTRY_OPTIONS.join("、");

  const response = await invokeLLM({
    max_tokens: 4096,
    timeout_ms: 120000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `可选行业方向（industry 字段必须从中选一）：${industryList}`,
          "",
          "企业资料原文：",
          trimmed.slice(0, 48000),
          "",
          "请输出 JSON 对象，字段：brandName, industry, customIndustry, businessSummary, mainPlatforms, targetCustomers, customerPainPoints, competitors, caseSummary, caseActions, caseResults, confidenceNotes",
        ].join("\n"),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "enterprise_profile_document_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            brandName: { type: "string" },
            industry: { type: "string" },
            customIndustry: { type: "string" },
            businessSummary: { type: "string" },
            mainPlatforms: { type: "string" },
            targetCustomers: { type: "string" },
            customerPainPoints: {
              type: "array",
              items: { type: "string" },
              maxItems: 8,
            },
            competitors: {
              type: "array",
              items: { type: "string" },
              maxItems: 12,
            },
            caseSummary: { type: "string" },
            caseActions: { type: "string" },
            caseResults: { type: "string" },
            confidenceNotes: {
              type: "array",
              items: { type: "string" },
              maxItems: 6,
            },
          },
          required: [
            "brandName",
            "industry",
            "customIndustry",
            "businessSummary",
            "mainPlatforms",
            "targetCustomers",
            "customerPainPoints",
            "competitors",
            "caseSummary",
            "caseActions",
            "caseResults",
            "confidenceNotes",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = parseAnalysisJson(response.choices[0]?.message.content);
  const norm = normalizeIndustry(parsed.industry, parsed.customIndustry);
  return {
    ...parsed,
    industry: norm.industry,
    customIndustry: norm.customIndustry,
    brandName: parsed.brandName?.trim() || null,
    businessSummary: parsed.businessSummary?.trim() || null,
    mainPlatforms: parsed.mainPlatforms?.trim() || null,
    targetCustomers: parsed.targetCustomers?.trim() || null,
    customerPainPoints: parsed.customerPainPoints.map(s => s.trim()).filter(Boolean).slice(0, 8),
    competitors: parsed.competitors.map(s => s.trim()).filter(Boolean).slice(0, 12),
    caseSummary: parsed.caseSummary?.trim() || null,
    caseActions: parsed.caseActions?.trim() || null,
    caseResults: parsed.caseResults?.trim() || null,
    confidenceNotes: parsed.confidenceNotes.map(s => s.trim()).filter(Boolean).slice(0, 6),
  };
}
