import { describe, expect, it } from "vitest";
import {
  buildContentRetestAttributionView,
  buildMonthlyReportContentImpactProof,
  buildRetestChangeConclusion,
  formatMonthlyReportImpactProofLine,
} from "./contentRetestAttribution";

describe("buildContentRetestAttributionView", () => {
  it("returns no_question when question text is missing", () => {
    const view = buildContentRetestAttributionView({ included: true });
    expect(view.status).toBe("no_question");
    expect(view.statusMessage).toContain("暂无关联AI搜索问题");
  });

  it("returns pending_retest when after data is missing", () => {
    const view = buildContentRetestAttributionView({
      questionText: "海豚知道是什么？",
      included: true,
      baseRuns: [
        { mentionedCompany: false, recommendedCompany: false, answerText: "基线回答" },
      ],
    });
    expect(view.status).toBe("pending_retest");
    expect(view.before.hasData).toBe(true);
    expect(view.after.hasData).toBe(false);
  });

  it("returns ready with change conclusion when brand mention starts", () => {
    const view = buildContentRetestAttributionView({
      questionText: "海豚知道是什么？",
      baseRuns: [
        { mentionedCompany: false, recommendedCompany: false, answerText: "基线未提及" },
      ],
      compareRuns: [
        { mentionedCompany: true, recommendedCompany: true, answerText: "复测已提及品牌" },
      ],
    });
    expect(view.status).toBe("ready");
    expect(view.changeConclusion).toContain("发布后AI开始提及品牌");
    expect(view.before.answerSummary).toContain("基线未提及");
    expect(view.after.answerSummary).toContain("复测已提及品牌");
  });

  it("returns retesting when monitor status is checking", () => {
    const view = buildContentRetestAttributionView({
      questionText: "海豚知道是什么？",
      aiMentionMonitorStatus: "检测中",
      included: true,
    });
    expect(view.status).toBe("retesting");
  });
});

describe("buildRetestChangeConclusion", () => {
  it("detects mention rate increase", () => {
    const conclusion = buildRetestChangeConclusion({
      before: {
        label: "优化前基线",
        hasData: true,
        mentionsBrand: true,
        brandMentionRate: 0.2,
        brandRecommendRate: 0.1,
        answerSummary: null,
      },
      after: {
        label: "发布后复测",
        hasData: true,
        mentionsBrand: true,
        brandMentionRate: 0.42,
        brandRecommendRate: 0.1,
        answerSummary: null,
      },
    });
    expect(conclusion).toContain("提及率从20%提升至42%");
  });
});

describe("buildMonthlyReportContentImpactProof", () => {
  it("builds customer-facing impact proof lines", () => {
    const proof = buildMonthlyReportContentImpactProof([
      {
        articleId: 1,
        title: "海豚知道介绍",
        platform: "知乎",
        questionText: "海豚知道是什么？",
        attribution: buildContentRetestAttributionView({
          questionText: "海豚知道是什么？",
          baseRuns: [{ mentionedCompany: false, recommendedCompany: false, answerText: "a" }],
          compareRuns: [{ mentionedCompany: true, recommendedCompany: false, answerText: "b" }],
        }),
      },
    ]);
    expect(proof.hasData).toBe(true);
    expect(proof.items[0]?.changeConclusion).toContain("发布后AI开始提及品牌");
    expect(formatMonthlyReportImpactProofLine(proof.items[0]!)).toContain("知乎·海豚知道是什么？");
  });
});
