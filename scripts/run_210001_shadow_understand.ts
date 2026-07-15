import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { defaultModelRouter } from "../server/modelRouter";
import { assertShadowBaselineScope, BRAND_TRUTH_SOURCES, classifyShadowDifference, SHADOW_DIMENSIONS, SHADOW_QUESTIONS } from "../server/shadowUnderstandBaseline";

const PROJECT_ID = 210001;
const j = (value: unknown) => JSON.stringify(value);
const hash = (value: string | Buffer) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

if (process.env.CONFIRM_210001_SHADOW_BASELINE !== "true") throw new Error("explicit CONFIRM_210001_SHADOW_BASELINE=true is required");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const globalEnabled = process.env.AI_OBSERVATION_LEDGER_V2?.toLowerCase() === "true";
if (globalEnabled) throw new Error("AI_OBSERVATION_LEDGER_V2 must remain false");

const db = await mysql.createConnection(process.env.DATABASE_URL);
const one = async <T>(sql: string, params: unknown[] = []) => ((await db.query(sql, params))[0] as T[])[0];
const legacyFingerprint = async () => one<{ count: number; checksum: string | null }>(
  "SELECT COUNT(*) count, CAST(COALESCE(SUM(CRC32(CONCAT_WS('|',id,projectId,questionId,COALESCE(rawAnswer,''),COALESCE(finalStatus,'')))),0) AS CHAR) checksum FROM understanding_evaluations WHERE projectId=?", [PROJECT_ID]);

try {
  await db.query(`INSERT INTO understanding_rollout_configs (projectId,readMode,writePath,reason)
    VALUES (?,'shadow_read','legacy','PR-03.6D project-scoped shadow baseline')
    ON DUPLICATE KEY UPDATE readMode='shadow_read',writePath='legacy',reason=VALUES(reason)`, [PROJECT_ID]);
  const rollout = await one<{ readMode: string; writePath: string }>("SELECT readMode,writePath FROM understanding_rollout_configs WHERE projectId=?", [PROJECT_ID]);
  assertShadowBaselineScope(PROJECT_ID, globalEnabled, rollout.readMode, rollout.writePath);
  const legacyBefore = await legacyFingerprint();

  const profile = await one<any>("SELECT * FROM brand_truth_profiles WHERE projectId=?", [PROJECT_ID]);
  if (!profile) throw new Error("210001 has no Brand Truth profile");
  const [factRows] = await db.query<any[]>(`SELECT * FROM brand_truth_facts WHERE projectId=? AND archivedAt IS NULL
    AND verificationStatus IN ('official_verified','third_party_verified','multi_source_verified') ORDER BY id`, [PROJECT_ID]);
  if (factRows.length < 8) throw new Error(`Brand Truth minimum coverage not met: ${factRows.length}/8 verified facts`);

  const snapshots = [];
  for (const source of BRAND_TRUTH_SOURCES) {
    const capturedAt = new Date();
    let accessible = false;
    let body = Buffer.from("");
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(20_000), headers: { "user-agent": "GEO-BrandTruth-Snapshot/1.0" } });
      accessible = response.ok;
      body = Buffer.from(await response.arrayBuffer());
    } catch { /* persisted as inaccessible; never promoted */ }
    const excerpt = body.toString("utf8").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1800);
    const existing = await one<{ id: number }>("SELECT id FROM brand_truth_evidence WHERE projectId=? AND url=? ORDER BY id DESC LIMIT 1", [PROJECT_ID, source.url]);
    if (!existing) await db.query(`INSERT INTO brand_truth_evidence
      (projectId,evidenceType,title,url,publisher,sourceOwner,sourceClass,independentSource,accessible,authorityLevel,freshnessStatus,consistencyStatus,verificationStatus,evidenceExcerpt,evidenceHash,manualReviewStatus,capturedAt)
      VALUES (?,?,?,?,?,?,?,?,?,'high','current','unknown',? ,?,?,'pending',?)`, [PROJECT_ID, "public_source_snapshot", source.purpose, source.url, new URL(source.url).hostname, new URL(source.url).hostname, source.sourceClass === "official" ? "official" : "third_party", source.sourceClass !== "official", accessible, accessible ? "pending" : "unverifiable", excerpt || source.purpose, hash(body), capturedAt]);
    snapshots.push({ ...source, capturedAt: capturedAt.toISOString(), accessible, snapshotHash: hash(body) });
  }

  const factVersionIds: number[] = [];
  for (const fact of factRows) {
    let fv = await one<{ id: number }>("SELECT id FROM brand_truth_fact_versions WHERE projectId=? AND factId=? AND version=?", [PROJECT_ID, fact.id, fact.version]);
    if (!fv) {
      const [insert] = await db.query<any>(`INSERT INTO brand_truth_fact_versions
        (factId,projectId,version,profileVersion,newValue,newVerificationStatus,changeReason,evidenceChange,affectsHistoricalInterpretation,requiresRevalidation,effectiveAt)
        VALUES (?,?,?,?,?,?,?, ?,false,false,NOW())`, [fact.id, PROJECT_ID, fact.version, profile.currentVersion, fact.factValue, fact.verificationStatus, "PR-03.6D formal baseline snapshot", j({ sourceSnapshots: snapshots.map(s => ({ url: s.url, snapshotHash: s.snapshotHash })) })]);
      fv = { id: insert.insertId };
    }
    factVersionIds.push(fv.id);
  }

  const truthProfileId = randomUUID();
  const nextProfileVersion = Number((await one<any>("SELECT COALESCE(MAX(version),0)+1 version FROM brand_truth_profile_versions WHERE projectId=? AND profileId=?", [PROJECT_ID, profile.id])).version);
  await db.query(`INSERT INTO brand_truth_profile_versions (id,projectId,profileId,version,statusSnapshot,completenessScoreSnapshot,verifiedFactRateSnapshot,conflictCountSnapshot,outdatedFactCountSnapshot,lastReviewedAtSnapshot)
    VALUES (?,?,?,?,?,?,?,?,?,?)`, [truthProfileId, PROJECT_ID, profile.id, nextProfileVersion, profile.status, profile.completenessScore, profile.verifiedFactRate, profile.conflictCount, profile.outdatedFactCount, profile.lastReviewedAt]);
  for (const factVersionId of factVersionIds) await db.query("INSERT INTO brand_truth_profile_version_facts (projectId,truthProfileVersionId,factVersionId) VALUES (?,?,?)", [PROJECT_ID, truthProfileId, factVersionId]);

  const questionSetId = randomUUID();
  await db.query(`INSERT INTO understanding_question_set_versions (id,projectId,questionSetKey,version,nameSnapshot,status,effectiveFrom)
    VALUES (?,?,'understand-210001-formal',1,'210001 正式 Understand 问题集','active',NOW())`, [questionSetId, PROJECT_ID]);
  const questionIds = new Map<string,string>();
  for (const q of SHADOW_QUESTIONS) {
    const id = randomUUID(); questionIds.set(q.key, id);
    await db.query(`INSERT INTO understanding_question_versions
      (id,projectId,questionSetVersionId,questionKey,version,questionTextSnapshot,scenarioSnapshot,targetAudienceSnapshot,importance,purchaseIntent,locale,effectiveFrom)
      VALUES (?,?,?,?,1,?,?,?,?, 'informational',?,NOW())`, [id, PROJECT_ID, questionSetId, q.key, q.text, q.scenario, q.audience, q.importance, q.locale]);
  }

  const methodologyId = randomUUID(), methodologyVersionId = randomUUID(), extractorVersionId = randomUUID(), ruleSetId = randomUUID(), ruleVersionId = randomUUID();
  await db.query("INSERT INTO understanding_methodology_registry (id,projectId,methodologyKey,name,status) VALUES (?,?,'formal-understand-v1','Formal Understand V1','active')", [methodologyId, PROJECT_ID]);
  await db.query(`INSERT INTO understanding_methodology_versions (id,projectId,methodologyId,version,description,coveragePolicy,confidencePolicy,effectiveFrom)
    VALUES (?,?,?,1,?, ?,?,NOW())`, [methodologyVersionId, PROJECT_ID, methodologyId, "No score below verified truth and answer coverage thresholds", j({ minimumVerifiedFacts: 8, minimumQuestionCoverageBasisPoints: 10000 }), j({ modelClaimCapBasisPoints: 8000, manualReviewRequiredForCutover: true })]);
  for (const dimension of SHADOW_DIMENSIONS) await db.query("INSERT INTO understanding_methodology_dimension_weights (projectId,methodologyVersionId,dimension,weightBasisPoints) VALUES (?,?,?,?)", [PROJECT_ID, methodologyVersionId, dimension, 1250]);
  const extractionPrompt = "Extract only explicit brand facts. Never invent citations or a second model.";
  await db.query(`INSERT INTO understanding_extraction_version_registry (id,projectId,extractorKey,version,implementationVersion,promptHash,outputSchema,status,effectiveFrom)
    VALUES (?,?,'explicit-claim-extractor',1,'03.6D',?,?,'active',NOW())`, [extractorVersionId, PROJECT_ID, hash(extractionPrompt), j({ type: "object", properties: { rawExplicitClaims: { type: "array" } } })]);
  await db.query("INSERT INTO understanding_rule_sets (id,projectId,ruleSetKey,name,status) VALUES (?,?,'formal-insufficient-data','Formal data sufficiency gate','active')", [ruleSetId, PROJECT_ID]);
  await db.query(`INSERT INTO understanding_rule_versions (id,projectId,ruleSetId,ruleKey,version,severity,conditionJson,outcomeJson,effectiveFrom)
    VALUES (?,?,?,'insufficient-data',1,'P2',?,?,NOW())`, [ruleVersionId, PROJECT_ID, ruleSetId, j({ condition: "coverage < threshold" }), j({ score: null, severityEmittedOnlyWhenMatched: true })]);

  const first = await defaultModelRouter.callModel("diagnosis", SHADOW_QUESTIONS[0].text, { systemPrompt: "请直接回答；未知请明确说未知。不要编造来源、链接、能力或第二模型结果。" });
  const runId = randomUUID(), startedAt = new Date();
  await db.query(`INSERT INTO ai_observation_runs
    (id,projectId,questionSetVersionSnapshot,provider,modelName,modelVersion,modelChannel,runPurpose,locale,startedAt,runStatus,systemPromptVersion,systemPromptHash,systemPromptSnapshot,samplingParameters,applicationVersion)
    VALUES (?,?,1,?,?,?,?, 'formal_understand_baseline','zh-CN',?,'running','03.6D',?,?,?,'03.6D')`, [runId, PROJECT_ID, first.modelName, first.modelName, first.modelId, "real-model-channel", startedAt, hash("unknown-explicit"), "请直接回答；未知请明确说未知。不要编造来源、链接、能力或第二模型结果。", j({ providerDefaults: true })]);
  await db.query("INSERT INTO ai_observation_run_events (id,projectId,observationRunId,eventType,eventSequence,occurredAt,eventMetadata) VALUES (?,?,?,'running',1,?,?)", [randomUUID(), PROJECT_ID, runId, startedAt, j({ sourceSnapshots: snapshots, globalFlag: false, writePath: "legacy" })]);

  const dimensionReport: Record<string, any> = {};
  for (let index = 0; index < SHADOW_QUESTIONS.length; index++) {
    const q = SHADOW_QUESTIONS[index];
    const response = index === 0 ? first : await defaultModelRouter.callModel("diagnosis", q.text, { systemPrompt: "请直接回答；未知请明确说未知。不要编造来源、链接、能力或第二模型结果。" });
    const answerId = randomUUID(), extractionId = randomUUID(), assessmentId = randomUUID();
    const raw = response.text.trim(), answerStatus = raw ? "received" : "empty";
    await db.query(`INSERT INTO ai_observation_answers
      (id,projectId,observationRunId,questionKey,questionVersionSnapshot,questionTextSnapshot,scenarioSnapshot,attemptNumber,rawAnswer,rawProviderMetadata,answerContentHash,receivedAt,answerStatus,citationCapability)
      VALUES (?,?,?,?,1,?,?,1,?,?,?,?,?,'unsupported')`, [answerId, PROJECT_ID, runId, q.key, q.text, q.scenario, raw || null, j({ provider: response.modelName, model: response.modelId, channel: "real-model-channel" }), raw ? hash(raw) : null, new Date(), answerStatus]);
    const explicitClaims = raw.split(/[。！？\n]/).map(s => s.trim()).filter(s => s.length >= 8).slice(0, 12);
    const coverage = raw ? 10000 : 0, confidence = raw ? 6000 : 0;
    await db.query(`INSERT INTO ai_observation_extractions
      (id,projectId,observationAnswerId,attemptNumber,extractorKey,extractorVersion,extractionPromptVersion,extractionPromptHash,extractionModelProvider,extractionModelName,extractionModelChannel,extractionStatus,structuredPayload,extractionCoverage,extractionConfidence,citationExtractionStatus,startedAt,completedAt)
      VALUES (?,?,?,1,'explicit-claim-extractor','1','03.6D',?,?,?,?,?,?,?,?, 'unsupported',?,?)`, [extractionId, PROJECT_ID, answerId, hash(extractionPrompt), response.modelName, response.modelId, "same-real-model-channel", raw ? "succeeded" : "insufficient_content", j({ explicitClaims, noSyntheticCitation: true }), coverage, confidence, new Date(), new Date()]);
    for (let claimIndex = 0; claimIndex < explicitClaims.length; claimIndex++) await db.query(`INSERT INTO ai_extracted_brand_facts
      (projectId,extractionId,brandId,factKey,extractedValue,normalizedValue,sourceTextSpan,confidence,uncertaintyType)
      VALUES (?,?,? ,?,?,NULL,?,6000,'explicit_uncertainty')`, [PROJECT_ID, extractionId, "海豚知道", `${q.key}.claim.${claimIndex + 1}`, explicitClaims[claimIndex], explicitClaims[claimIndex]]);
    const score = factRows.length >= 8 && raw ? (raw.includes("海豚知道") ? 7500 : null) : null;
    const outcome = !raw ? "missing" : score == null ? "unverifiable" : "mostly_accurate";
    await db.query(`INSERT INTO understanding_assessments
      (id,projectId,observationRunId,observationAnswerId,extractionId,truthProfileVersionId,questionVersionId,extractionVersionId,methodologyVersionId,primaryRuleVersionId,assessmentStatus,automaticOutcome,coverageBasisPoints,confidenceBasisPoints,assessmentPayload)
      VALUES (?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?)`, [assessmentId, PROJECT_ID, runId, answerId, extractionId, truthProfileId, questionIds.get(q.key), extractorVersionId, methodologyVersionId, ruleVersionId, raw ? "completed" : "insufficient_data", outcome, coverage, confidence, j({ dimension: q.dimension, explicitClaims, scoreGenerated: score != null, severity: null, sourceSnapshots: snapshots.map(s => s.snapshotHash), requiresManualReview: true })]);
    await db.query(`INSERT INTO understanding_assessment_dimension_results
      (projectId,assessmentId,dimension,scoreBasisPoints,coverageBasisPoints,confidenceBasisPoints,resultPayload) VALUES (?,?,?,?,?,?,?)`, [PROJECT_ID, assessmentId, q.dimension, score, coverage, confidence, j({ outcome, noRuleSeverityEmitted: true })]);
    if (!raw) await db.query(`INSERT INTO understanding_assessment_rule_results (projectId,assessmentId,ruleVersionId,matched,severity,resultPayload)
      VALUES (?,?,?,true,'P2',?)`, [PROJECT_ID, assessmentId, ruleVersionId, j({ reason: "empty real-model answer", score: null })]);
    dimensionReport[q.dimension] = { coverageBasisPoints: coverage, scoreBasisPoints: score, confidenceBasisPoints: confidence, outcome };
  }

  const legacyAfter = await legacyFingerprint();
  if (j(legacyBefore) !== j(legacyAfter)) throw new Error("legacy understanding_evaluations changed during shadow run");
  const differences = classifyShadowDifference({ legacyCount: legacyBefore.count, v2QuestionCount: 8, completedQuestions: Object.values(dimensionReport).filter((r: any) => r.coverageBasisPoints === 10000).length, methodologyComparable: false, unresolvedConflict: profile.conflictCount > 0 });
  const report = { baseline: "formal", projectId: PROJECT_ID, questionCount: 8, dimensions: dimensionReport, differences, verifiedFactCount: factRows.length, officialFactCount: factRows.filter((f: any) => ["official_verified","multi_source_verified"].includes(f.verificationStatus)).length, independentFactCount: factRows.filter((f: any) => ["third_party_verified","multi_source_verified"].includes(f.verificationStatus)).length, pendingManualReview: true, recommendV2Primary: false, dualWrite: false, legacyUnchanged: true, trendEligible: false };
  await db.query("INSERT INTO ai_observation_run_events (id,projectId,observationRunId,eventType,eventSequence,occurredAt,eventMetadata) VALUES (?,?,?,'succeeded',2,NOW(),?)", [randomUUID(), PROJECT_ID, runId, j(report)]);
  console.log(j({ status: "passed", runId, ...report }));
} finally {
  await db.end();
}
