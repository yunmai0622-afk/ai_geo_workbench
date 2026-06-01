import {
  buildDeliveryReportCsvContent,
  buildGeoPublishRecordsCsvFilename,
  buildGeoReportCsvFilename,
  buildPublishRecordsCsvContent,
  type DetectionQuestionExportRow,
  type PublishRecordExportRow,
  type T0T1ExportInput,
} from "@shared/geoDataExport";
import type { AiTestEvidenceAggregate } from "@shared/aiTestEvidence";

export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadDeliveryReportCsv(params: {
  projectName: string;
  detectionQuestions: DetectionQuestionExportRow[];
  aggregate: AiTestEvidenceAggregate;
  t0t1: T0T1ExportInput;
}): void {
  const content = buildDeliveryReportCsvContent({
    detectionQuestions: params.detectionQuestions,
    aggregate: params.aggregate,
    t0t1: params.t0t1,
  });
  downloadTextFile(content, buildGeoReportCsvFilename(params.projectName));
}

export function downloadPublishRecordsCsv(params: {
  projectName: string;
  rows: PublishRecordExportRow[];
}): void {
  const content = buildPublishRecordsCsvContent(params.rows);
  downloadTextFile(content, buildGeoPublishRecordsCsvFilename(params.projectName));
}
