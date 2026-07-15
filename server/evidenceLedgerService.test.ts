import {describe,expect,it} from "vitest";
import {evidenceGaps,EVIDENCE_QUALITY_FACTORS,EVIDENCE_TYPES,evaluateEvidenceQuality} from "./evidenceLedgerService";
import {readFileSync} from "node:fs";
describe("public Evidence Ledger",()=>{
  it("has six discrete quality factors and no score",()=>{const q=evaluateEvidenceQuality({statusCode:200,ownership:"owned",independent:false,publicationTime:null,linkedFactCount:1,conflict:false,checkedAt:new Date()});expect(Object.keys(q)).toEqual([...EVIDENCE_QUALITY_FACTORS]);expect(Object.values(q).every(x=>["pass","warning","fail","unknown"].includes(x))).toBe(true);expect(q).not.toHaveProperty("score");});
  it("supports official third-party and operations evidence",()=>{expect(EVIDENCE_TYPES).toContain("official_homepage");expect(EVIDENCE_TYPES).toContain("media");expect(EVIDENCE_TYPES).toContain("demo");});
  it("reports categorical gaps without scoring",()=>{expect(evidenceGaps([{ownership:"owned",type:"official_homepage",approved:true},{ownership:"third_party",type:"media",approved:true}])).toEqual(["case","faq","schema","partner"]);});
  it("never deletes snapshots or auto-upgrades truth",()=>{const source=readFileSync("server/evidenceLedgerService.ts","utf8");expect(source).not.toMatch(/delete\(trustSourceSnapshots\)|update\(brandTruthFacts\)|insert\(understandingQuestionVersions\)/);expect(source).toContain("snapshotVersion");});
  it("supports many evidence per fact and shared questions",()=>{const schema=readFileSync("drizzle/schema.ts","utf8");expect(schema).toContain('trust_evidence_fact_links_unique").on(table.evidenceItemId,table.factId');expect(schema).toContain('trust_evidence_question_links_unique").on(table.evidenceItemId,table.questionVersionId');});
});
