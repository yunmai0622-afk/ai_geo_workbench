import { eq } from "drizzle-orm";
import { geoInclusionMonitoringRecords } from "../drizzle/schema";
import { buildInitialInclusionMonitoringRecord } from "./geoMonitoring";
import type { getDb } from "./db";

type DbConn = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function ensureInclusionMonitoringRecordForPublishRecord(
  db: DbConn,
  input: {
    projectId: number;
    articleId: number;
    publishRecordId: number;
    publicUrl: string;
    qualityScore: number;
    rawJsonSource?: string;
    rawJsonCreatedBy?: string;
  },
): Promise<boolean> {
  const publicUrl = input.publicUrl.trim();
  if (!publicUrl) return false;

  const existingRows = await db
    .select({ id: geoInclusionMonitoringRecords.id })
    .from(geoInclusionMonitoringRecords)
    .where(eq(geoInclusionMonitoringRecords.publishRecordId, input.publishRecordId))
    .limit(1);
  if (existingRows.length > 0) return false;

  await db.insert(geoInclusionMonitoringRecords).values(
    buildInitialInclusionMonitoringRecord({
      projectId: input.projectId,
      articleId: input.articleId,
      publishRecordId: input.publishRecordId,
      publicUrl,
      qualityScore: input.qualityScore,
      rawJsonSource: input.rawJsonSource,
      rawJsonCreatedBy: input.rawJsonCreatedBy,
    }),
  );
  return true;
}
