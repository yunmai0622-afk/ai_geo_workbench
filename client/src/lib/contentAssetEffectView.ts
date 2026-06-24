import type { ContentAssetNextAction } from "@shared/contentAssetEffectTracking";
import type { ContentRetestAttributionView } from "@shared/contentRetestAttribution";
import { resolveContentAssetLifecycleStage } from "@shared/contentAssetLifecycle";

export type ContentAssetEffectViewRecord = {
  id: number;
  articleId: number;
  publishRecordId: number;
  publicUrl: string;
  articleTitle?: string | null;
  linkedDetectionQuestion?: string | null;
  publishChannel?: string | null;
  publishedAt?: Date | string | null;
  effectInclusionStatus?: string | null;
  inclusionStatusLabel?: string;
  effectStatusLabel?: string;
  inclusionVerifiedAt?: Date | string | null;
  inclusionKeywords?: string[] | null;
  readCount?: number | null;
  impressionCount?: number | null;
  interactionCount?: number | null;
  searchTriggerKeywords?: string[] | null;
  dataSourceLabel?: string | null;
  evidenceScreenshotUrl?: string | null;
  evidenceNotes?: string | null;
  eligibleForAiRetest?: boolean;
  lastAiTestedAt?: Date | string | null;
  aiTestResults?: unknown[] | null;
  retestAttribution?: ContentRetestAttributionView | null;
  nextAction?: ContentAssetNextAction;
};

export function mapContentAssetEffectRecordForView(
  record: ContentAssetEffectViewRecord & { canEnterAiRetest?: boolean },
): ContentAssetEffectViewRecord {
  const eligibleForAiRetest = record.canEnterAiRetest;
  const { canEnterAiRetest: _omit, ...rest } = record;
  return { ...rest, eligibleForAiRetest };
}

export function resolveMonitoringRecordLifecycle(record: ContentAssetEffectViewRecord) {
  return resolveContentAssetLifecycleStage({
    article: { status: "已发布" },
    publishRecord: {
      publishUrl: record.publicUrl,
      publishedAt: record.publishedAt,
    },
    inclusionRecord: {
      effectInclusionStatus: record.effectInclusionStatus,
      inclusionVerifiedAt: record.inclusionVerifiedAt,
      readCount: record.readCount,
      impressionCount: record.impressionCount,
      lastAiTestedAt: record.lastAiTestedAt,
      aiTestResults: record.aiTestResults,
    },
  });
}
