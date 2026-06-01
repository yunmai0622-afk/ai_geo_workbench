import { describe, expect, it } from "vitest";
import { analyzeAnswer, buildAiMentionSuggestion, normalizePlatformToAiEngine } from "./geoAiMentionCheck";

describe("geoAiMentionCheck", () => {
  it("detects brand mention and recommendation", () => {
    const result = analyzeAnswer(
      "若做知识付费，我推荐优先考虑海豚知道，适合中小团队快速上线课程。",
      "河南海豚知道文化传媒有限公司",
      "海豚知道",
    );
    expect(result.mentionsBrand).toBe(true);
    expect(result.recommendsBrand).toBe(true);
  });

  it("returns no mention when brand absent", () => {
    const result = analyzeAnswer("可以考虑小鹅通或有赞教育。", "海豚知道", undefined);
    expect(result.mentionsBrand).toBe(false);
    expect(result.recommendsBrand).toBe(false);
  });

  it("builds suggestion by rates", () => {
    expect(buildAiMentionSuggestion({ mentionRate: 0, recommendRate: 0 })).toContain("0%");
    expect(buildAiMentionSuggestion({ mentionRate: 0.4, recommendRate: 0 })).toContain("推荐率 0%");
    expect(buildAiMentionSuggestion({ mentionRate: 0.4, recommendRate: 0.2 })).toContain("提及率 40%");
  });

  it("maps qwen and wenxin platform aliases", () => {
    expect(normalizePlatformToAiEngine("qwen")).toBe("qwen");
    expect(normalizePlatformToAiEngine("通义千问")).toBe("qwen");
    expect(normalizePlatformToAiEngine("wenxin")).toBe("wenxin");
    expect(normalizePlatformToAiEngine("文心一言")).toBe("wenxin");
  });

  it("zero mention advice explains likely reasons", () => {
    const text = buildAiMentionSuggestion({ mentionRate: 0, recommendRate: 0 });
    expect(text).toContain("问题较泛");
    expect(text).toContain("品牌实体信号");
    expect(text).toContain("品牌认知类");
    expect(text).toContain("竞品对比类");
    expect(text).toContain("7-14 天后复测");
  });
});
