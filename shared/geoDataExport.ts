import type { AiTestEvidenceAggregate } from "./aiTestEvidence";
import {
  buildOverallChangeSummary,
  changeDirectionSymbol,
  formatOverallSummaryLines,
  resolvePlatformDisplayLabel,
  resolveQuestionTypeDisplayLabel,
  type RetestComparisonRow,
  type TestRoundSummary,
} from "./retestComparisonDisplay";

export const GEO_CSV_UTF8_BOM = "\uFEFF";

export function escapeCsvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function joinCsvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(escapeCsvCell).join(",");
}

export type CsvSection = {
  title: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
};

export function buildCsvDocument(sections: CsvSection[]): string {
  const lines: string[] = [];
  for (const section of sections) {
    lines.push(section.title);
    lines.push(joinCsvRow(section.headers));
    for (const row of section.rows) {
      lines.push(joinCsvRow(row));
    }
    lines.push("");
  }
  return `${GEO_CSV_UTF8_BOM}${lines.join("\r\n")}`;
}

export function sanitizeGeoExportFilenameSegment(name: string): string {
  const trimmed = name.trim().replace(/[/\\?%*:|"<>]/g, "-");
  return trimmed.length > 0 ? trimmed : "project";
}

export function buildGeoReportCsvFilename(projectName: string, date = new Date()): string {
  const datePart = date.toISOString().slice(0, 10);
  return `geo-report-${sanitizeGeoExportFilenameSegment(projectName)}-${datePart}.csv`;
}

export function buildGeoPublishRecordsCsvFilename(projectName: string, date = new Date()): string {
  const datePart = date.toISOString().slice(0, 10);
  return `geo-publish-records-${sanitizeGeoExportFilenameSegment(projectName)}-${datePart}.csv`;
}

export type DetectionQuestionExportRow = {
  questionText: string;
  questionType: string;
  enabled: boolean;
};

export function buildDetectionQuestionsCsvSection(rows: DetectionQuestionExportRow[]): CsvSection {
  return {
    title: "检测问题列表",
    headers: ["问题文本", "问题类型", "启用状态"],
    rows: rows.map(row => [
      row.questionText,
      row.questionType,
      row.enabled ? "启用" : "禁用",
    ]),
  };
}

export function buildPlatformMentionCsvSection(
  byEngine: AiTestEvidenceAggregate["byEngine"],
): CsvSection {
  return {
    title: "各平台提及情况",
    headers: ["AI 平台", "实测题数", "提及率", "推荐率"],
    rows: byEngine
      .filter(engine => engine.questionCount > 0)
      .map(engine => [
        engine.engineName,
        engine.questionCount,
        `${Math.round(engine.mentionRate * 100)}%`,
        `${Math.round(engine.recommendRate * 100)}%`,
      ]),
  };
}

export type T0T1ExportInput = {
  baseRound: TestRoundSummary | null;
  compareRound: TestRoundSummary | null;
  rows: RetestComparisonRow[];
};

export function buildT0T1ComparisonCsvSection(input: T0T1ExportInput): CsvSection {
  const summary = buildOverallChangeSummary(input.rows, input.baseRound, input.compareRound);
  const summaryLines = formatOverallSummaryLines(summary);
  const headerNote =
    input.baseRound && input.compareRound
      ? `基线：${input.baseRound.roundName} · 复测：${input.compareRound.roundName}`
      : "暂无 T0/T1 轮次";

  const detailRows = input.rows.map(row => [
    resolveQuestionTypeDisplayLabel(row.questionType),
    resolvePlatformDisplayLabel(row.platform),
    row.baseMentionCount,
    row.compareMentionCount,
    changeDirectionSymbol(row.changeDirection),
    row.systemConclusion,
  ]);

  return {
    title: `T0/T1 对比数据（${headerNote}）`,
    headers: [
      "问题类型",
      "平台",
      "T0 提及次数",
      "T1 提及次数",
      "变化方向",
      "系统判断",
    ],
    rows: [
      ["整体摘要", summaryLines.mentionLine, "", "", "", ""],
      ["整体摘要", summaryLines.recommendLine, "", "", "", ""],
      ["整体摘要", summaryLines.competitorLine, "", "", "", ""],
      ...detailRows,
    ],
  };
}

export function buildDeliveryReportCsvContent(params: {
  detectionQuestions: DetectionQuestionExportRow[];
  aggregate: AiTestEvidenceAggregate;
  t0t1: T0T1ExportInput;
}): string {
  return buildCsvDocument([
    buildDetectionQuestionsCsvSection(params.detectionQuestions),
    buildPlatformMentionCsvSection(params.aggregate.byEngine),
    buildT0T1ComparisonCsvSection(params.t0t1),
  ]);
}

export type PublishRecordExportRow = {
  title: string;
  platform: string;
  publishedAt: string;
  link: string;
  status: string;
};

export function buildPublishRecordsCsvSection(rows: PublishRecordExportRow[]): CsvSection {
  return {
    title: "发布记录",
    headers: ["标题", "平台", "发布时间", "链接", "状态"],
    rows: rows.map(row => [row.title, row.platform, row.publishedAt, row.link, row.status]),
  };
}

export function buildPublishRecordsCsvContent(rows: PublishRecordExportRow[]): string {
  return buildCsvDocument([buildPublishRecordsCsvSection(rows)]);
}
