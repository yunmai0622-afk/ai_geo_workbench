import type { ContentAssetNextAction } from "@shared/contentAssetEffectTracking";

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
  nextAction?: ContentAssetNextAction;
};

export function mapContentAssetEffectRecordForView(
  record: ContentAssetEffectViewRecord & { canEnterAiRetest?: boolean },
): ContentAssetEffectViewRecord {
  const eligibleForAiRetest = record.canEnterAiRetest;
  const { canEnterAiRetest: _omit, ...rest } = record;
  return { ...rest, eligibleForAiRetest };
}
