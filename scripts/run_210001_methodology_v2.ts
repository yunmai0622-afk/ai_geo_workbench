import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { defaultModelRouter } from "../server/modelRouter";
import { compareV1V2Quality, UNDERSTAND_EXTRACTION_V2_FIELDS, UNDERSTAND_V2_DEFINITIONS, UNDERSTAND_V2_QUESTIONS, validateMethodologyV2 } from "../server/understandMethodologyV2";

const PROJECT_ID=210001, j=(v:unknown)=>JSON.stringify(v), hash=(v:string)=>`sha256:${createHash("sha256").update(v).digest("hex")}`;
if(process.env.CONFIRM_210001_METHODOLOGY_V2!=="true") throw new Error("explicit v2 baseline confirmation required");
if(process.env.AI_OBSERVATION_LEDGER_V2?.toLowerCase()==="true") throw new Error("global v2 flag must remain false");
if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
validateMethodologyV2();
const db=await mysql.createConnection(process.env.DATABASE_URL);
const one=async<T>(sql:string,p:unknown[]=[])=>{const [rows]=await db.query(sql,p);return (rows as T[])[0];};
const first=async<T>(sql:string,p:unknown[]=[])=>(await db.query(sql,p))[0] as T[];
const legacyFingerprint=()=>one<any>("SELECT COUNT(*) count,CAST(COALESCE(SUM(CRC32(CONCAT_WS('|',id,projectId,questionId,COALESCE(rawAnswer,''),COALESCE(finalStatus,'')))),0) AS CHAR) checksum FROM understanding_evaluations WHERE projectId=?",[PROJECT_ID]);
const parseJson=(text:string)=>{try{return JSON.parse(text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/, ""));}catch{return null;}};
try{
  const legacyBefore=await legacyFingerprint();
  const rollout=await one<any>("SELECT readMode,writePath FROM understanding_rollout_configs WHERE projectId=?",[PROJECT_ID]);
  if(rollout?.readMode!=="shadow_read"||rollout?.writePath!=="legacy") throw new Error("210001 must remain shadow_read / legacy write");
  const existing=await one<any>("SELECT id FROM ai_observation_runs WHERE projectId=? AND runPurpose='formal_understand_baseline_v2' LIMIT 1",[PROJECT_ID]);
  if(existing) throw new Error(`v2 baseline already exists: ${existing.id}`);
  const truthProfile=await one<any>("SELECT * FROM brand_truth_profile_versions WHERE projectId=? ORDER BY createdAt DESC LIMIT 1",[PROJECT_ID]);
  if(!truthProfile) throw new Error("truth profile version missing");
  const facts=await first<any>("SELECT * FROM brand_truth_facts WHERE projectId=? AND archivedAt IS NULL",[PROJECT_ID]);
  const evidence=await first<any>(`SELECT e.*,l.factId FROM brand_truth_evidence e JOIN brand_truth_fact_evidence_links l ON l.evidenceId=e.id AND l.projectId=e.projectId
    WHERE e.projectId=? AND l.supportType='supports'`,[PROJECT_ID]);

  const methodologyRegistryId=randomUUID(),methodologyVersionId=randomUUID();
  await db.query("INSERT INTO understanding_methodology_registry (id,projectId,methodologyKey,name,status) VALUES (?,?,'formal-understand-v2','Formal Understand V2','active')",[methodologyRegistryId,PROJECT_ID]);
  await db.query(`INSERT INTO understanding_methodology_versions (id,projectId,methodologyId,version,description,coveragePolicy,confidencePolicy,effectiveFrom)
    VALUES (?,?,?,2,?,?,?,NOW())`,[methodologyVersionId,PROJECT_ID,methodologyRegistryId,"Frozen product methodology v2; risk factors are not primary dimensions",j({questionExecution:10000,extraction:8000,verifiedTruth:7000,evidence:6000,assessment:8000,noScoreWhenUnverifiable:true}),j({answer:2500,extraction:2500,verifiedTruth:2500,evidence:1500,consistency:1000,uncertaintyPenalty:true})]);
  for(const definition of UNDERSTAND_V2_DEFINITIONS){
    await db.query("INSERT INTO understanding_methodology_dimension_weights (projectId,methodologyVersionId,dimension,weightBasisPoints) VALUES (?,?,?,?)",[PROJECT_ID,methodologyVersionId,definition.dimension,definition.weightBasisPoints]);
    await db.query(`INSERT INTO understanding_methodology_dimension_definitions
      (projectId,methodologyVersionId,dimension,displayName,weightBasisPoints,factKeys,questionTypes,extractionFields,judgmentRules,coverageThresholdBasisPoints,unverifiableConditions,confidencePolicy,severityRules,subdimensions)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[PROJECT_ID,methodologyVersionId,definition.dimension,definition.displayName,definition.weightBasisPoints,j(definition.factKeys),j(definition.questionTypes),j(definition.extractionFields),j(definition.judgmentRules),definition.coverageThresholdBasisPoints,j(definition.unverifiableConditions),j(definition.confidencePolicy),j(definition.severityRules),j(definition.subdimensions)]);
  }

  const questionSetId=randomUUID();
  await db.query("INSERT INTO understanding_question_set_versions (id,projectId,questionSetKey,version,nameSnapshot,status,effectiveFrom) VALUES (?,?,'understand-210001-formal',2,'210001 正式 Understand 问题集 V2','active',NOW())",[questionSetId,PROJECT_ID]);
  const questionVersions=new Map<string,string>();
  for(const question of UNDERSTAND_V2_QUESTIONS){const id=randomUUID();questionVersions.set(question.key,id);
    await db.query(`INSERT INTO understanding_question_versions (id,projectId,questionSetVersionId,questionKey,version,questionTextSnapshot,scenarioSnapshot,targetAudienceSnapshot,importance,purchaseIntent,locale,effectiveFrom)
      VALUES (?,?,?,?,2,?,?,?,?, 'informational','zh-CN',NOW())`,[id,PROJECT_ID,questionSetId,question.key,question.text,question.scenario,question.audience,question.importance]);
    await db.query("INSERT INTO understanding_question_dimension_bindings (projectId,questionVersionId,primaryDimension,secondaryDimensions,subdimension) VALUES (?,?,?,?,?)",[PROJECT_ID,id,question.primaryDimension,j(question.secondaryDimensions),question.subdimension??null]);
  }
  const extractionVersionId=randomUUID();
  const extractionPrompt=`Return JSON with exactly these fields: ${UNDERSTAND_EXTRACTION_V2_FIELDS.join(",")}. Values must be arrays of explicit claims or null; uncertainty_statement records uncertainty only. Do not invent citations.`;
  await db.query(`INSERT INTO understanding_extraction_version_registry (id,projectId,extractorKey,version,implementationVersion,promptHash,outputSchema,status,effectiveFrom)
    VALUES (?,?,'understand-extraction-v2',2,'03.6F',?,?,'active',NOW())`,[extractionVersionId,PROJECT_ID,hash(extractionPrompt),j({type:"object",required:[...UNDERSTAND_EXTRACTION_V2_FIELDS],properties:Object.fromEntries(UNDERSTAND_EXTRACTION_V2_FIELDS.map(key=>[key,{anyOf:[{type:"array",items:{type:"string"}},{type:"null"}]}]))})]);
  const ruleSetId=randomUUID(),ruleVersionId=randomUUID();
  await db.query("INSERT INTO understanding_rule_sets (id,projectId,ruleSetKey,name,status) VALUES (?,?,'formal-v2-assessment','Formal V2 Assessment Rules','active')",[ruleSetId,PROJECT_ID]);
  await db.query("INSERT INTO understanding_rule_versions (id,projectId,ruleSetId,ruleKey,version,severity,conditionJson,outcomeJson,effectiveFrom) VALUES (?,?,?,'v2-data-sufficiency',2,'P2',?,?,NOW())",[ruleVersionId,PROJECT_ID,ruleSetId,j({match:"required coverage below threshold"}),j({outcome:"unverifiable",score:null,emitOnlyWhenMatched:true})]);

  const systemPrompt="基于当前可用信息直接回答；未知或来源冲突必须明确说明。不要编造链接、引用、能力、历史状态或第二模型。";
  const model=defaultModelRouter.getModel("diagnosis");
  const runId=randomUUID(),startedAt=new Date();
  await db.query(`INSERT INTO ai_observation_runs (id,projectId,questionSetVersionSnapshot,provider,modelName,modelVersion,modelChannel,runPurpose,locale,startedAt,runStatus,systemPromptVersion,systemPromptHash,systemPromptSnapshot,samplingParameters,applicationVersion)
    VALUES (?,?,2,?,?,?,?, 'formal_understand_baseline_v2','zh-CN',?,'running','03.6F',?,?,?,'03.6F')`,[runId,PROJECT_ID,model.name,model.name,model.modelId??model.name,"real-model-channel",startedAt,hash(systemPrompt),systemPrompt,j({providerDefaults:true})]);
  await db.query("INSERT INTO ai_observation_run_events (id,projectId,observationRunId,eventType,eventSequence,occurredAt,eventMetadata) VALUES (?,?,?,'running',1,?,?)",[randomUUID(),PROJECT_ID,runId,startedAt,j({methodologyVersionId,questionSetId,extractionVersionId,globalFlag:false,writePath:"legacy"})]);

  const results:any[]=[];
  for(const question of UNDERSTAND_V2_QUESTIONS){
    const response=await defaultModelRouter.callModel("diagnosis",question.text,{systemPrompt});
    const answerId=randomUUID(),receivedAt=new Date(),raw=response.text.trim();
    await db.query(`INSERT INTO ai_observation_answers (id,projectId,observationRunId,questionKey,questionVersionSnapshot,questionTextSnapshot,scenarioSnapshot,attemptNumber,rawAnswer,rawProviderMetadata,answerContentHash,receivedAt,answerStatus,citationCapability)
      VALUES (?,?,?,?,2,?,?,1,?,?,?,?,?,'unsupported')`,[answerId,PROJECT_ID,runId,question.key,question.text,question.scenario,raw||null,j({provider:response.modelName,model:response.modelId,channel:"real-model-channel"}),raw?hash(raw):null,receivedAt,raw?"received":"empty"]);
    const extractionResponse=raw?await defaultModelRouter.callModel("diagnosis",`${extractionPrompt}\n\nRAW ANSWER:\n${raw}`,{systemPrompt:"Extract only explicit content from RAW ANSWER. Output JSON only."}):null;
    const structured=extractionResponse?parseJson(extractionResponse.text):null;
    const extractionComplete=structured&&UNDERSTAND_EXTRACTION_V2_FIELDS.every(field=>Object.prototype.hasOwnProperty.call(structured,field));
    const extractionId=randomUUID();
    await db.query(`INSERT INTO ai_observation_extractions (id,projectId,observationAnswerId,attemptNumber,extractorKey,extractorVersion,extractionPromptVersion,extractionPromptHash,extractionModelProvider,extractionModelName,extractionModelChannel,extractionStatus,structuredPayload,extractionCoverage,extractionConfidence,citationExtractionStatus,startedAt,completedAt,errorCode,errorMessage)
      VALUES (?,?,?,1,'understand-extraction-v2','2','03.6F',?,?,?,?,?,?,?,?, 'unsupported',?,?,?,?)`,[extractionId,PROJECT_ID,answerId,hash(extractionPrompt),extractionResponse?.modelName??null,extractionResponse?.modelId??null,"same-real-model-channel",extractionComplete?"succeeded":raw?"partially_succeeded":"insufficient_content",j(structured??{parseFailed:Boolean(raw)}),extractionComplete?10000:raw?5000:0,extractionComplete?7000:raw?3000:0,receivedAt,new Date(),extractionComplete?null:"EXTRACTION_INCOMPLETE",extractionComplete?null:"Required v2 fields missing"]);
    if(structured) for(const [field,value] of Object.entries(structured)) for(const claim of Array.isArray(value)?value:[]){if(typeof claim!=="string"||!claim.trim())continue;await db.query("INSERT INTO ai_extracted_brand_facts (projectId,extractionId,brandId,factKey,extractedValue,sourceTextSpan,confidence,uncertaintyType) VALUES (?,?,? ,?,?,?,? ,?)",[PROJECT_ID,extractionId,"海豚知道",field,claim,claim,field==="uncertainty_statement"?4000:6500,field==="uncertainty_statement"?"explicit_uncertainty":"none"]);}
    const definition=UNDERSTAND_V2_DEFINITIONS.find(d=>d.dimension===question.primaryDimension)!;
    const matchedTruth=facts.filter(f=>definition.factKeys.includes(f.factKey as never)&&["official_verified","third_party_verified","multi_source_verified"].includes(f.verificationStatus));
    const matchedEvidence=evidence.filter(e=>matchedTruth.some(f=>f.id===e.factId)&&e.accessible&&e.verificationStatus==="verified");
    const truthCoverage=Math.round(Math.min(matchedTruth.length/Math.max(definition.factKeys.length,1),1)*10000);
    const evidenceFactCount=new Set(matchedEvidence.map(e=>e.factId)).size;
    const evidenceCoverage=Math.round(Math.min(evidenceFactCount/Math.max(definition.factKeys.length,1),1)*10000);
    const answerCoverage=raw?10000:0,extractionCoverage=extractionComplete?10000:raw?5000:0;
    const uncertainty=Array.isArray(structured?.uncertainty_statement)&&structured.uncertainty_statement.length>0;
    const confidence=Math.max(0,Math.min(10000,Math.round(answerCoverage*.25+extractionCoverage*.25+truthCoverage*.25+evidenceCoverage*.15+(uncertainty?0:1000))));
    const isVerifiable=answerCoverage===10000&&extractionCoverage>=8000&&truthCoverage>=definition.coverageThresholdBasisPoints&&evidenceCoverage>=6000;
    const outcome=isVerifiable?"mostly_accurate":"unverifiable",score=isVerifiable?(raw.includes("海豚知道")?7500:null):null;
    const reasons=[answerCoverage<10000&&"insufficient_answer",extractionCoverage<8000&&"extraction_incomplete",truthCoverage<definition.coverageThresholdBasisPoints&&"verified_truth_below_threshold",evidenceCoverage<6000&&"evidence_below_threshold",uncertainty&&"explicit_uncertainty"].filter(Boolean);
    const assessmentId=randomUUID();
    const reviewItem={rawAnswer:raw,extractedFacts:structured,matchedTruthFacts:matchedTruth.map(f=>({id:f.id,key:f.factKey,value:f.factValue,status:f.verificationStatus,validFrom:f.validFrom,validTo:f.validTo,temporalStatus:f.temporalStatus})),evidence:matchedEvidence.map(e=>({id:e.id,url:e.url,capturedAt:e.capturedAt,publishedAt:e.publishedAt,sourceUpdatedAt:e.sourceUpdatedAt,status:e.verificationStatus})),automaticResult:outcome,confidenceBasisPoints:confidence,unverifiableReasons:reasons,suggestedReviewAction:isVerifiable?"confirm_or_reject":"request_evidence_or_mark_insufficient_data"};
    await db.query(`INSERT INTO understanding_assessments (id,projectId,observationRunId,observationAnswerId,extractionId,truthProfileVersionId,questionVersionId,extractionVersionId,methodologyVersionId,primaryRuleVersionId,assessmentStatus,automaticOutcome,coverageBasisPoints,confidenceBasisPoints,assessmentPayload)
      VALUES (?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?)`,[assessmentId,PROJECT_ID,runId,answerId,extractionId,truthProfile.id,questionVersions.get(question.key),extractionVersionId,methodologyVersionId,ruleVersionId,isVerifiable?"completed":"insufficient_data",outcome,Math.round((answerCoverage+extractionCoverage+truthCoverage+evidenceCoverage)/4),confidence,j({primaryDimension:question.primaryDimension,secondaryDimensions:question.secondaryDimensions,subdimension:question.subdimension??null,coverage:{questionExecution:answerCoverage,extraction:extractionCoverage,verifiedTruth:truthCoverage,evidence:evidenceCoverage,assessment:isVerifiable?10000:5000},scoreGenerated:score!==null,severity:null,riskFactors:{evidence:evidenceCoverage,consistency:"not_scored_as_dimension",uncertainty},reviewItem})]);
    await db.query("INSERT INTO understanding_assessment_dimension_results (projectId,assessmentId,dimension,scoreBasisPoints,coverageBasisPoints,confidenceBasisPoints,resultPayload) VALUES (?,?,?,?,?,?,?)",[PROJECT_ID,assessmentId,question.primaryDimension,score,Math.round((answerCoverage+extractionCoverage+truthCoverage+evidenceCoverage)/4),confidence,j({subdimension:question.subdimension??null,outcome,coverage:{questionExecution:answerCoverage,extraction:extractionCoverage,verifiedTruth:truthCoverage,evidence:evidenceCoverage},unverifiableReasons:reasons})]);
    if(!isVerifiable) await db.query("INSERT INTO understanding_assessment_rule_results (projectId,assessmentId,ruleVersionId,matched,severity,resultPayload) VALUES (?,?,?,true,'P2',?)",[PROJECT_ID,assessmentId,ruleVersionId,j({dataSufficiencyOnly:true,reasons,score:null})]);
    results.push({dimension:question.primaryDimension,subdimension:question.subdimension??null,outcome,score,confidence,coverage:{questionExecution:answerCoverage,extraction:extractionCoverage,verifiedTruth:truthCoverage,evidence:evidenceCoverage,assessment:isVerifiable?10000:5000}});
  }
  const aggregate=(field:string)=>Math.round(results.reduce((sum,r)=>sum+r.coverage[field],0)/results.length);
  const v2Quality={question:aggregate("questionExecution"),extraction:aggregate("extraction"),truth:aggregate("verifiedTruth"),evidence:aggregate("evidence"),assessment:aggregate("assessment"),unverifiable:results.filter(r=>r.outcome==="unverifiable").length};
  const v1Quality={question:10000,extraction:10000,truth:10000,evidence:0,assessment:10000,unverifiable:3};
  const legacyAfter=await legacyFingerprint();if(j(legacyBefore)!==j(legacyAfter))throw new Error("legacy fingerprint changed");
  const report={status:"passed",runId,methodology:{key:"formal-understand-v2",version:2,id:methodologyVersionId,dimensions:UNDERSTAND_V2_DEFINITIONS.map(d=>d.dimension)},questionSet:{version:2,count:UNDERSTAND_V2_QUESTIONS.length},extraction:{key:"understand-extraction-v2",version:2,fields:UNDERSTAND_EXTRACTION_V2_FIELDS},results,coverage:v2Quality,comparison:compareV1V2Quality({v1:v1Quality,v2:v2Quality}),reviewItems:results.length,enterManualReview:results.length===9,primarySwitchAllowed:false,v1Preserved:true,legacyUnchanged:true,dualWrite:false,rollout:"shadow_read"};
  await db.query("INSERT INTO ai_observation_run_events (id,projectId,observationRunId,eventType,eventSequence,occurredAt,eventMetadata) VALUES (?,?,?,'succeeded',2,NOW(),?)",[randomUUID(),PROJECT_ID,runId,j(report)]);
  console.log(j(report));
}finally{await db.end();}
