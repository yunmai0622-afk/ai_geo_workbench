import {createHash,randomUUID} from "node:crypto";
import {and,desc,eq,inArray} from "drizzle-orm";
import {brandTruthFacts,trustEvidenceFactLinks,trustEvidenceLedgerItems,trustEvidenceQualityChecks,trustEvidenceQuestionLinks,trustEvidenceSources,trustSourceSnapshots,understandingAssessments,understandingQuestionVersions} from "../drizzle/schema";
import type {DbConn} from "./projectAccess";

export const EVIDENCE_QUALITY_FACTORS=["accessibility","authority","independence","consistency","freshness","relevance"] as const;
export type QualityState="pass"|"warning"|"fail"|"unknown";
export const EVIDENCE_TYPES=["official_homepage","brand_definition","product_page","faq","help_center","team","company","organization_schema","brand_schema","product_schema","media","industry_platform","customer_case","partner","certification","industry_report","github","zhihu","wechat_official_account","interview","video","product_screenshot","service_process","verifiable_data","customer_review","demo"] as const;

export function evaluateEvidenceQuality(input:{statusCode:number|null;ownership:"owned"|"third_party";independent:boolean;publicationTime:Date|null;linkedFactCount:number;conflict:boolean;checkedAt:Date}){
  const age=input.publicationTime?input.checkedAt.getTime()-input.publicationTime.getTime():null;
  return {
    accessibility: input.statusCode==null?"unknown":input.statusCode>=200&&input.statusCode<400?"pass":input.statusCode===401||input.statusCode===403?"warning":"fail",
    authority: input.ownership==="owned"?"pass":"warning",
    independence: input.independent?"pass":input.ownership==="owned"?"warning":"unknown",
    consistency: input.conflict?"fail":input.linkedFactCount?"pass":"unknown",
    freshness: age==null?"unknown":age<=1000*60*60*24*365*2?"pass":"warning",
    relevance: input.linkedFactCount?"pass":"unknown",
  } satisfies Record<(typeof EVIDENCE_QUALITY_FACTORS)[number],QualityState>;
}

export const EVIDENCE_GAP_CATEGORIES=["official","third_party","case","faq","schema","media","partner"] as const;
export function evidenceGaps(input:Array<{ownership:"owned"|"third_party";type:string;approved:boolean}>){
  const has={official:input.some(x=>x.ownership==="owned"&&x.approved),third_party:input.some(x=>x.ownership==="third_party"&&x.approved),case:input.some(x=>x.type==="customer_case"&&x.approved),faq:input.some(x=>x.type==="faq"&&x.approved),schema:input.some(x=>["organization_schema","brand_schema","product_schema"].includes(x.type)&&x.approved),media:input.some(x=>x.type==="media"&&x.approved),partner:input.some(x=>x.type==="partner"&&x.approved)};
  return EVIDENCE_GAP_CATEGORIES.filter(key=>!has[key]);
}

function htmlValue(html:string,pattern:RegExp){return html.match(pattern)?.[1]?.trim()??null;}
export class EvidenceLedgerService{
  constructor(private db:DbConn){}
  async create(input:{projectId:number;sourceUrl:string;sourceOwner?:string|null;ownership:"owned"|"third_party";independentSource:boolean;evidenceType:(typeof EVIDENCE_TYPES)[number];reviewStatus:"unverified"|"pending"|"approved"|"rejected";confidence?:number|null;createdBy?:number|null}){
    if(input.confidence!=null&&(input.confidence<0||input.confidence>10000))throw new Error("confidence must be 0..10000");
    const sourceId=randomUUID(),itemId=randomUUID(),evidenceId=`ev_${randomUUID()}`;
    await this.db.transaction(async tx=>{await tx.insert(trustEvidenceSources).values({id:sourceId,projectId:input.projectId,sourceUrl:input.sourceUrl,sourceOwner:input.sourceOwner,ownership:input.ownership,independentSource:input.independentSource});await tx.insert(trustEvidenceLedgerItems).values({id:itemId,evidenceId,projectId:input.projectId,sourceId,evidenceType:input.evidenceType,reviewStatus:input.reviewStatus,confidence:input.confidence,createdBy:input.createdBy});});
    return {sourceId,itemId,evidenceId};
  }
  async checkUrl(projectId:number,itemId:string){
    const item=(await this.db.select().from(trustEvidenceLedgerItems).where(and(eq(trustEvidenceLedgerItems.id,itemId),eq(trustEvidenceLedgerItems.projectId,projectId))).limit(1))[0];if(!item)throw new Error("evidence item not found");
    const source=(await this.db.select().from(trustEvidenceSources).where(and(eq(trustEvidenceSources.id,item.sourceId),eq(trustEvidenceSources.projectId,projectId))).limit(1))[0];if(!source)throw new Error("source not found");
    const checkedAt=new Date();let statusCode:number|null=null,body="",finalUrl=source.sourceUrl,headers:Headers|null=null;
    try{const response=await fetch(source.sourceUrl,{redirect:"follow",signal:AbortSignal.timeout(20000),headers:{"user-agent":"GEO-Evidence-Ledger/1.0"}});statusCode=response.status;finalUrl=response.url;headers=response.headers;body=await response.text();}catch{/* immutable failed snapshot */}
    const latest=(await this.db.select({version:trustSourceSnapshots.snapshotVersion}).from(trustSourceSnapshots).where(and(eq(trustSourceSnapshots.sourceId,source.id),eq(trustSourceSnapshots.projectId,projectId))).orderBy(desc(trustSourceSnapshots.snapshotVersion)).limit(1))[0];
    const snapshotId=randomUUID(),snapshotVersion=(latest?.version??0)+1,canonical=htmlValue(body,/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)??htmlValue(body,/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical/i),title=htmlValue(body,/<title[^>]*>([^<]*)<\/title>/i);
    const publicationTime=headers?.get("last-modified")?new Date(headers.get("last-modified")!):null;
    const accessStatus=statusCode==null?"inaccessible":finalUrl!==source.sourceUrl?"redirected":statusCode>=200&&statusCode<400?"accessible":statusCode===401||statusCode===403?"blocked":"inaccessible";
    const links=await this.db.select().from(trustEvidenceFactLinks).where(and(eq(trustEvidenceFactLinks.projectId,projectId),eq(trustEvidenceFactLinks.evidenceItemId,itemId)));
    const quality=evaluateEvidenceQuality({statusCode,ownership:source.ownership,independent:source.independentSource,publicationTime,linkedFactCount:links.length,conflict:links.some(x=>x.relationship==="contradicts"),checkedAt});
    await this.db.transaction(async tx=>{await tx.insert(trustSourceSnapshots).values({id:snapshotId,projectId,sourceId:source.id,snapshotVersion,sourceUrlSnapshot:source.sourceUrl,statusCode,accessedAt:checkedAt,contentHash:body?`sha256:${createHash("sha256").update(body).digest("hex")}`:null,titleSnapshot:title,ownerSnapshot:source.sourceOwner,canonicalUrl:canonical,redirectUrl:finalUrl!==source.sourceUrl?finalUrl:null,robotsStatus:headers?.get("x-robots-tag")?.includes("noindex")?"disallowed":"unknown",publicationTime,updatedTime:publicationTime,contentExcerpt:body.replace(/<[^>]+>/g," ").replace(/\s+/g," ").slice(0,2000),metadata:{contentType:headers?.get("content-type")??null}});await tx.update(trustEvidenceSources).set({accessStatus,firstCheckedAt:source.firstCheckedAt??checkedAt,lastCheckedAt:checkedAt}).where(and(eq(trustEvidenceSources.id,source.id),eq(trustEvidenceSources.projectId,projectId)));await tx.update(trustEvidenceLedgerItems).set({latestSnapshotId:snapshotId}).where(and(eq(trustEvidenceLedgerItems.id,itemId),eq(trustEvidenceLedgerItems.projectId,projectId)));await tx.insert(trustEvidenceQualityChecks).values({id:randomUUID(),projectId,evidenceItemId:itemId,snapshotId,...quality,details:{aggregateScore:null},checkedAt});});
    return {snapshotId,snapshotVersion,statusCode,quality};
  }
  async updateSourceUrl(projectId:number,itemId:string,sourceUrl:string){
    const item=(await this.db.select().from(trustEvidenceLedgerItems).where(and(eq(trustEvidenceLedgerItems.id,itemId),eq(trustEvidenceLedgerItems.projectId,projectId))).limit(1))[0];
    if(!item)throw new Error("evidence item not found");
    await this.db.update(trustEvidenceSources).set({sourceUrl}).where(and(eq(trustEvidenceSources.id,item.sourceId),eq(trustEvidenceSources.projectId,projectId)));
    return this.checkUrl(projectId,itemId);
  }
  async linkFact(projectId:number,itemId:string,factId:number,relationship:"supports"|"contradicts"|"context_only"="supports"){
    const [item,fact]=await Promise.all([this.db.select({id:trustEvidenceLedgerItems.id}).from(trustEvidenceLedgerItems).where(and(eq(trustEvidenceLedgerItems.id,itemId),eq(trustEvidenceLedgerItems.projectId,projectId))).limit(1),this.db.select({id:brandTruthFacts.id}).from(brandTruthFacts).where(and(eq(brandTruthFacts.id,factId),eq(brandTruthFacts.projectId,projectId))).limit(1)]);if(!item[0]||!fact[0])throw new Error("cross-project or missing evidence/fact");await this.db.insert(trustEvidenceFactLinks).values({projectId,evidenceItemId:itemId,factId,relationship}).onDuplicateKeyUpdate({set:{relationship}});
  }
  async linkQuestion(projectId:number,itemId:string,questionVersionId:string,relationship:"primary"|"supporting"|"context_only"="supporting"){
    const [item,q]=await Promise.all([this.db.select({id:trustEvidenceLedgerItems.id}).from(trustEvidenceLedgerItems).where(and(eq(trustEvidenceLedgerItems.id,itemId),eq(trustEvidenceLedgerItems.projectId,projectId))).limit(1),this.db.select({id:understandingQuestionVersions.id}).from(understandingQuestionVersions).where(and(eq(understandingQuestionVersions.id,questionVersionId),eq(understandingQuestionVersions.projectId,projectId))).limit(1)]);if(!item[0]||!q[0])throw new Error("cross-project or missing evidence/question");await this.db.insert(trustEvidenceQuestionLinks).values({projectId,evidenceItemId:itemId,questionVersionId,relationship}).onDuplicateKeyUpdate({set:{relationship}});
  }
  async graph(projectId:number){const [items,factLinks,questionLinks]=await Promise.all([this.db.select().from(trustEvidenceLedgerItems).where(eq(trustEvidenceLedgerItems.projectId,projectId)),this.db.select().from(trustEvidenceFactLinks).where(eq(trustEvidenceFactLinks.projectId,projectId)),this.db.select().from(trustEvidenceQuestionLinks).where(eq(trustEvidenceQuestionLinks.projectId,projectId))]);const qIds=[...new Set(questionLinks.map(x=>x.questionVersionId))];const assessments=qIds.length?await this.db.select().from(understandingAssessments).where(and(eq(understandingAssessments.projectId,projectId),inArray(understandingAssessments.questionVersionId,qIds))):[];return {items,factLinks,questionLinks,assessments,recommendations:[],recommendationNotice:"PR-04A does not generate recommendations"};}
  async gaps(projectId:number){const [facts,links,items,sources]=await Promise.all([this.db.select().from(brandTruthFacts).where(eq(brandTruthFacts.projectId,projectId)),this.db.select().from(trustEvidenceFactLinks).where(and(eq(trustEvidenceFactLinks.projectId,projectId),eq(trustEvidenceFactLinks.relationship,"supports"))),this.db.select().from(trustEvidenceLedgerItems).where(eq(trustEvidenceLedgerItems.projectId,projectId)),this.db.select().from(trustEvidenceSources).where(eq(trustEvidenceSources.projectId,projectId))]);return facts.map(fact=>{const linked=links.filter(l=>l.factId===fact.id).map(l=>items.find(i=>i.id===l.evidenceItemId)).filter(Boolean) as typeof items;const sourceById=new Map(sources.map(s=>[s.id,s]));return {factId:fact.id,factKey:fact.factKey,currentEvidence:linked.length,missing:evidenceGaps(linked.map(i=>({ownership:sourceById.get(i.sourceId)?.ownership??"third_party",type:i.evidenceType,approved:i.reviewStatus==="approved"})))};});}
}
