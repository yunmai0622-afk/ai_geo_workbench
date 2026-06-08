import { describe, expect, it } from "vitest";
import { aggregateAiPlatformPerformance } from "./aiPlatformPerformance";

describe("aggregateAiPlatformPerformance", () => {
  it("marks untested platforms as 未实测", () => {
    const rows = aggregateAiPlatformPerformance([]);
    expect(rows).toHaveLength(5);
    expect(rows.every(row => row.status === "未实测")).toBe(true);
    expect(rows[0]?.summary).toBe("本轮未实测");
  });

  it("detects competitor advantage and recommendation states", () => {
    const rows = aggregateAiPlatformPerformance([
      {
        platform: "qwen",
        mentionedCompany: true,
        recommendedCompany: false,
        competitorMentioned: false,
      },
      {
        platform: "doubao",
        mentionedCompany: true,
        recommendedCompany: false,
        competitorMentioned: true,
      },
      {
        platform: "doubao",
        mentionedCompany: true,
        recommendedCompany: true,
        competitorMentioned: true,
      },
      {
        platform: "kimi",
        mentionedCompany: true,
        recommendedCompany: true,
        competitorMentioned: false,
        hasSourceLinks: true,
      },
    ]);
    const qwen = rows.find(row => row.platformId === "qwen");
    const doubao = rows.find(row => row.platformId === "doubao");
    const kimi = rows.find(row => row.platformId === "kimi");
    expect(qwen?.status).toBe("已提及，推荐不足");
    expect(doubao?.status).toBe("竞品占优");
    expect(kimi?.status).toBe("已推荐");
    expect(kimi?.citationCount).toBe(1);
  });
});
