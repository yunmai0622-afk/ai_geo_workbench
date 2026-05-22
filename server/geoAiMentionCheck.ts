/**
 * AI 引擎真实可见度实测
 * 支持：豆包（火山引擎）、DeepSeek、Kimi
 */

import type { AiTestEvidenceItem, AiTestStage } from "@shared/aiTestEvidence";
import { enrichAiTestResult, type EnrichAiTestResultContext } from "./geoAiMentionEvidence";

export type AiEngine = "doubao" | "deepseek" | "kimi";

export interface AiTestResult {
  engine: AiEngine;
  engineName: string;
  question: string;
  answer: string;
  mentionsBrand: boolean;
  recommendsBrand: boolean;
  recommendationRank: number | null;
  testedAt: string;
}

export type { AiTestEvidenceItem };

export interface AiMentionCheckInput {
  enterpriseName: string;
  shortName?: string;
  questions: string[];
  engines?: AiEngine[];
  /** 企业档案 / 项目配置中的竞品名称，用于竞品提及分析 */
  competitorNames?: string[];
  /** 测试阶段：发布前 / 发布后复测 / 人工复测 */
  testStage?: AiTestStage;
  /** 用于未提及原因诊断（如文章发布时间） */
  missReasonContext?: EnrichAiTestResultContext;
}

export interface AiMentionCheckOutput {
  results: AiTestEvidenceItem[];
  mentionRate: number;
  recommendRate: number;
  engineSummary: Record<
    AiEngine,
    {
      mentionCount: number;
      recommendCount: number;
      totalQuestions: number;
    }
  >;
}

const ENGINE_CONFIG: Record<
  AiEngine,
  {
    name: string;
    apiUrl: string;
    model: string;
    apiKey: string;
  }
> = {
  doubao: {
    name: "豆包",
    apiUrl: process.env.OPENAI_BASE_URL
      ? `${process.env.OPENAI_BASE_URL}/chat/completions`
      : "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    model: process.env.OPENAI_MODEL ?? "ep-20251210143333-s6bb7",
    apiKey: process.env.OPENAI_API_KEY ?? "",
  },
  deepseek: {
    name: "DeepSeek",
    apiUrl: process.env.OPENAI_BASE_URL
      ? `${process.env.OPENAI_BASE_URL}/chat/completions`
      : "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    model: process.env.ARK_DEEPSEEK_MODEL_ID ?? process.env.OPENAI_MODEL ?? "ep-20251210143333-s6bb7",
    apiKey: process.env.OPENAI_API_KEY ?? "",
  },
  kimi: {
    name: "Kimi",
    apiUrl: "https://api.moonshot.cn/v1/chat/completions",
    model: "moonshot-v1-8k",
    apiKey: process.env.KIMI_API_KEY ?? "",
  },
};

async function askEngine(engine: AiEngine, question: string): Promise<string | null> {
  const config = ENGINE_CONFIG[engine];
  const apiKey = config.apiKey;

  if (!apiKey) {
    console.warn(`[实测] ${config.name} API Key 未配置，跳过`);
    return null;
  }

  try {
    const res = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: question }],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[实测] ${config.name} 请求失败 HTTP ${res.status}:`, err);
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data?.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error(`[实测] ${config.name} 请求异常:`, e);
    return null;
  }
}

export function analyzeAnswer(
  answer: string,
  enterpriseName: string,
  shortName?: string,
): { mentionsBrand: boolean; recommendsBrand: boolean; recommendationRank: number | null } {
  const lowerAnswer = answer.toLowerCase();
  const names = [enterpriseName, shortName].filter(Boolean) as string[];

  const mentionsBrand = names.some(name => lowerAnswer.includes(name.toLowerCase()));

  if (!mentionsBrand) {
    return { mentionsBrand: false, recommendsBrand: false, recommendationRank: null };
  }

  const recommendKeywords = ["推荐", "建议", "首选", "优先", "可以考虑", "不错", "适合", "值得"];
  const recommendsBrand = recommendKeywords.some(kw => {
    const idx = answer.indexOf(kw);
    if (idx === -1) return false;
    const context = answer.slice(Math.max(0, idx - 50), idx + 50);
    return names.some(name => context.includes(name));
  });

  let recommendationRank: number | null = null;
  if (recommendsBrand) {
    for (const name of names) {
      const idx = answer.indexOf(name);
      if (idx === -1) continue;
      const before = answer.slice(Math.max(0, idx - 20), idx);
      const rankMatch = before.match(/第\s*([一二三四五六七八九十\d]+)|(\d+)\s*[\.、]/);
      if (rankMatch) {
        const chineseMap: Record<string, number> = {
          一: 1,
          二: 2,
          三: 3,
          四: 4,
          五: 5,
          六: 6,
          七: 7,
          八: 8,
          九: 9,
          十: 10,
        };
        const rankStr = rankMatch[1] || rankMatch[2];
        recommendationRank = chineseMap[rankStr] ?? parseInt(rankStr, 10) ?? null;
        break;
      }
    }
  }

  return { mentionsBrand, recommendsBrand, recommendationRank };
}

export function buildAiMentionSuggestion(result: { mentionRate: number; recommendRate: number }): string {
  const mentionPct = Math.round(result.mentionRate * 100);
  const recommendPct = Math.round(result.recommendRate * 100);

  if (mentionPct === 0) {
    return `实测结果：品牌在豆包/DeepSeek/Kimi 中均未被提及（提及率 0%）。本次实测中，品牌暂未被 AI 主动提及。可能是问题较泛、品牌实体信号不足，或内容尚未被 AI 检索到。当前问题多为场景痛点类或通用解决方案类问题，AI 更倾向直接给出方法，而不是推荐具体品牌。建议后续补充品牌认知类、竞品对比类内容，并在文章中强化「品牌名 + 品类 + 适用场景」的实体信号。新发布内容建议 7-14 天后复测。`;
  }
  if (recommendPct === 0) {
    return `实测结果：品牌提及率 ${mentionPct}%，但尚未获得 AI 推荐（推荐率 0%）。建议强化竞品差异化内容和客户案例。`;
  }
  return `实测结果：品牌提及率 ${mentionPct}%，AI 推荐率 ${recommendPct}%。继续保持内容更新节奏，扩大 AI 可见度。`;
}

export async function runAiMentionCheck(input: AiMentionCheckInput): Promise<AiMentionCheckOutput> {
  const engines = input.engines ?? (["doubao", "deepseek", "kimi"] as AiEngine[]);
  const results: AiTestEvidenceItem[] = [];
  const questions = input.questions.slice(0, 5);
  const competitorNames = input.competitorNames ?? [];
  const brandNames = [input.enterpriseName, input.shortName].filter(Boolean) as string[];
  const testStage = input.testStage ?? "manual_check";
  const missReasonContext = input.missReasonContext;

  for (const engine of engines) {
    const config = ENGINE_CONFIG[engine];

    for (const question of questions) {
      const answer = await askEngine(engine, question);
      if (!answer) continue;

      const analysis = analyzeAnswer(answer, input.enterpriseName, input.shortName);

      results.push(
        enrichAiTestResult(
          {
            engine,
            engineName: config.name,
            question,
            answer,
            ...analysis,
            testedAt: new Date().toISOString(),
          },
          competitorNames,
          brandNames,
          testStage,
          missReasonContext,
        ),
      );

      await new Promise(r => setTimeout(r, 500));
    }

    const engineResults = results.filter(r => r.engine === engine);
    console.log(
      `[实测] ${config.name} 完成：提及 ${engineResults.filter(r => r.mentionsBrand).length}/${engineResults.length}，推荐 ${engineResults.filter(r => r.recommendsBrand).length}/${engineResults.length}`,
    );
  }

  const engineSummary = {} as AiMentionCheckOutput["engineSummary"];
  for (const engine of engines) {
    const engineResults = results.filter(r => r.engine === engine);
    engineSummary[engine] = {
      mentionCount: engineResults.filter(r => r.mentionsBrand).length,
      recommendCount: engineResults.filter(r => r.recommendsBrand).length,
      totalQuestions: engineResults.length,
    };
  }

  const totalMentions = results.filter(r => r.mentionsBrand).length;
  const totalRecommends = results.filter(r => r.recommendsBrand).length;
  const total = results.length;

  return {
    results,
    mentionRate: total > 0 ? totalMentions / total : 0,
    recommendRate: total > 0 ? totalRecommends / total : 0,
    engineSummary,
  };
}
