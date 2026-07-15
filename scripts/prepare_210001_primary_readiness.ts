import "dotenv/config";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { BASELINE_V1_TO_FROZEN_MAPPING, FROZEN_UNDERSTAND_DIMENSIONS, UNVERIFIABLE_REVIEW_PLAN } from "../server/understandPrimaryReadiness";

const projectId = 210001;
if (process.env.CONFIRM_210001_PRIMARY_READINESS !== "true") throw new Error("explicit readiness confirmation is required");
if (process.env.AI_OBSERVATION_LEDGER_V2?.toLowerCase() === "true") throw new Error("global v2 flag must remain false");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = await mysql.createConnection(process.env.DATABASE_URL);
const one = async <T>(sql: string, params: unknown[] = []) => ((await db.query(sql, params))[0] as T[])[0];
const fingerprint = () => one<any>("SELECT COUNT(*) count, CAST(COALESCE(SUM(CRC32(CONCAT_WS('|',id,projectId,questionId,COALESCE(rawAnswer,''),COALESCE(finalStatus,'')))),0) AS CHAR) checksum FROM understanding_evaluations WHERE projectId=?", [projectId]);

try {
  const before = await fingerprint();
  const rollout = await one<any>("SELECT readMode,writePath FROM understanding_rollout_configs WHERE projectId=?", [projectId]);
  if (rollout?.readMode !== "shadow_read" || rollout?.writePath !== "legacy") throw new Error("210001 must remain shadow_read / legacy write");
  const latest = await one<any>(`SELECT a.observationRunId,a.methodologyVersionId,m.methodologyId,m.version
    FROM understanding_assessments a JOIN understanding_methodology_versions m ON m.id=a.methodologyVersionId AND m.projectId=a.projectId
    WHERE a.projectId=? ORDER BY a.createdAt DESC LIMIT 1`, [projectId]);
  if (!latest) throw new Error("formal baseline not found");
  const [actualDimensions] = await db.query<any[]>("SELECT dimension,weightBasisPoints FROM understanding_methodology_dimension_weights WHERE projectId=? AND methodologyVersionId=? ORDER BY id", [projectId, latest.methodologyVersionId]);

  let v2 = await one<any>("SELECT id,version FROM understanding_methodology_versions WHERE projectId=? AND methodologyId=? AND version=2", [projectId, latest.methodologyId]);
  if (!v2) {
    const id = randomUUID();
    await db.beginTransaction();
    try {
      await db.query(`INSERT INTO understanding_methodology_versions
        (id,projectId,methodologyId,version,description,coveragePolicy,confidencePolicy,effectiveFrom)
        VALUES (?,?,?,2,?,?,?,NOW())`, [id, projectId, latest.methodologyId,
        "Frozen 8-dimension Understand methodology: identity/category/business/products-services/customers/scenarios/capability-differentiation/boundary-temporal",
        JSON.stringify({ separateCoverage: ["question_execution","extraction","verified_truth","evidence","assessment"], scoreRequiresVerifiedTruthAndEvidence: true }),
        JSON.stringify({ unverifiableHasNoAutomaticZeroScore: true, manualReviewAppendOnly: true })]);
      for (const dimension of FROZEN_UNDERSTAND_DIMENSIONS) await db.query("INSERT INTO understanding_methodology_dimension_weights (projectId,methodologyVersionId,dimension,weightBasisPoints) VALUES (?,?,?,1250)", [projectId, id, dimension]);
      await db.commit(); v2 = { id, version: 2 };
    } catch (error) { await db.rollback(); throw error; }
  }

  await db.beginTransaction();
  await db.query("UPDATE understanding_rollout_configs SET readMode='legacy_only',writePath='legacy',reason='PR-03.6E rollback verification transaction' WHERE projectId=?", [projectId]);
  const rollbackState = await one<any>("SELECT readMode,writePath FROM understanding_rollout_configs WHERE projectId=?", [projectId]);
  if (rollbackState.readMode !== "legacy_only" || rollbackState.writePath !== "legacy") throw new Error("rollback verification failed");
  await db.rollback();
  const restored = await one<any>("SELECT readMode,writePath FROM understanding_rollout_configs WHERE projectId=?", [projectId]);
  if (restored.readMode !== "shadow_read" || restored.writePath !== "legacy") throw new Error("rollback verification changed production rollout");

  const after = await fingerprint();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("legacy data fingerprint changed");
  const review = await one<any>(`SELECT COUNT(DISTINCT r.assessmentId) reviewed, COUNT(DISTINCT a.id) assessments
    FROM understanding_assessments a LEFT JOIN understanding_assessment_manual_reviews r ON r.assessmentId=a.id AND r.projectId=a.projectId
    WHERE a.projectId=? AND a.observationRunId=?`, [projectId, latest.observationRunId]);
  console.log(JSON.stringify({ status:"passed", projectId, baselineMethodologyVersion:latest.version, baselineMethodologyVersionId:latest.methodologyVersionId, actualDimensions, mapping:BASELINE_V1_TO_FROZEN_MAPPING, newFrozenMethodologyVersion:v2.version, newFrozenMethodologyVersionId:v2.id, manualReviews:{ reviewed:Number(review.reviewed), assessments:Number(review.assessments), complete:Number(review.reviewed)>=Number(review.assessments) }, unverifiable:UNVERIFIABLE_REVIEW_PLAN, rollout:restored, rollbackVerified:true, legacyUnchanged:true, dualWrite:false, recommendV2Primary:false }));
} finally { await db.end(); }
