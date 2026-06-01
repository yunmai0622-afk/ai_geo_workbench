import { describe, expect, it } from "vitest";
import {
  GEO_CSV_UTF8_BOM,
  buildDeliveryReportCsvContent,
  buildGeoReportCsvFilename,
  buildPublishRecordsCsvContent,
  escapeCsvCell,
} from "./geoDataExport";

describe("geoDataExport", () => {
  it("escapeCsvCell quotes cells with commas or newlines", () => {
    expect(escapeCsvCell("plain")).toBe("plain");
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
  });

  it("buildGeoReportCsvFilename uses project name and date", () => {
    expect(buildGeoReportCsvFilename("Acme Corp", new Date("2026-06-01T12:00:00Z"))).toBe(
      "geo-report-Acme Corp-2026-06-01.csv",
    );
  });

  it("buildDeliveryReportCsvContent includes BOM and section headers", () => {
    const csv = buildDeliveryReportCsvContent({
      detectionQuestions: [
        { questionText: "Q1", questionType: "品牌认知", enabled: true },
      ],
      aggregate: {
        questionCount: 1,
        engineCount: 1,
        mentionRate: 0.5,
        recommendRate: 0.25,
        averageRank: null,
        sentimentCounts: { positive: 0, neutral: 1, negative: 0 },
        competitorMentionCount: 0,
        citedUrlCount: 0,
        byEngine: [
          {
            engineName: "豆包",
            questionCount: 1,
            mentionRate: 0.5,
            recommendRate: 0.25,
            dominantSentiment: "neutral",
            lastTestedAt: null,
          },
        ],
        keySamples: [],
        publishCompare: {
          before: {
            hasData: false,
            questionCount: 0,
            mentionRate: null,
            recommendRate: null,
            averageRank: null,
            citedUrlCount: null,
          },
          after: {
            hasData: false,
            questionCount: 0,
            mentionRate: null,
            recommendRate: null,
            averageRank: null,
            citedUrlCount: null,
          },
          changes: {
            mentionRateDelta: null,
            recommendRateDelta: null,
            averageRankDelta: null,
            citedUrlCountDelta: null,
          },
          hasAnyStageData: false,
        },
      },
      t0t1: { baseRound: null, compareRound: null, rows: [] },
    });

    expect(csv.startsWith(GEO_CSV_UTF8_BOM)).toBe(true);
    expect(csv).toContain("检测问题列表");
    expect(csv).toContain("各平台提及情况");
    expect(csv).toContain("T0/T1 对比数据");
    expect(csv).toContain("Q1");
    expect(csv).toContain("豆包");
  });

  it("buildPublishRecordsCsvContent exports publish columns", () => {
    const csv = buildPublishRecordsCsvContent([
      {
        title: "文章A",
        platform: "知乎",
        publishedAt: "2026/06/01",
        link: "https://example.com/a",
        status: "已发布",
      },
    ]);
    expect(csv.startsWith(GEO_CSV_UTF8_BOM)).toBe(true);
    expect(csv).toContain("发布记录");
    expect(csv).toContain("文章A");
    expect(csv).toContain("https://example.com/a");
  });
});
