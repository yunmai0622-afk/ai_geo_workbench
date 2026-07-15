import {TRPCError} from "@trpc/server";
import {z} from "zod";
import {operatorAdminProcedure,router} from "./_core/trpc";
import {getDb} from "./db";
import {getCurrentUserId,requireProjectAccess} from "./projectAccess";
import {EVIDENCE_TYPES,EvidenceLedgerService} from "./evidenceLedgerService";
const project=z.object({projectId:z.number().int().positive()});
async function service(ctx:any,projectId:number){await requireProjectAccess(ctx,projectId);const db=await getDb();if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR",message:"数据库不可用"});return new EvidenceLedgerService(db);}
export const evidenceLedgerRouter=router({
  create:operatorAdminProcedure.input(project.extend({sourceUrl:z.string().url().max(2000),sourceOwner:z.string().max(255).optional().nullable(),ownership:z.enum(["owned","third_party"]),independentSource:z.boolean(),evidenceType:z.enum(EVIDENCE_TYPES),reviewStatus:z.enum(["unverified","pending","approved","rejected"]).default("unverified"),confidence:z.number().int().min(0).max(10000).optional().nullable()})).mutation(async({ctx,input})=>(await service(ctx,input.projectId)).create({...input,createdBy:getCurrentUserId(ctx)})),
  checkUrl:operatorAdminProcedure.input(project.extend({itemId:z.string().uuid()})).mutation(async({ctx,input})=>(await service(ctx,input.projectId)).checkUrl(input.projectId,input.itemId)),
  updateSourceUrl:operatorAdminProcedure.input(project.extend({itemId:z.string().uuid(),sourceUrl:z.string().url().max(2000)})).mutation(async({ctx,input})=>(await service(ctx,input.projectId)).updateSourceUrl(input.projectId,input.itemId,input.sourceUrl)),
  linkFact:operatorAdminProcedure.input(project.extend({itemId:z.string().uuid(),factId:z.number().int().positive(),relationship:z.enum(["supports","contradicts","context_only"]).default("supports")})).mutation(async({ctx,input})=>{await(await service(ctx,input.projectId)).linkFact(input.projectId,input.itemId,input.factId,input.relationship);return{success:true as const};}),
  linkQuestion:operatorAdminProcedure.input(project.extend({itemId:z.string().uuid(),questionVersionId:z.string().uuid(),relationship:z.enum(["primary","supporting","context_only"]).default("supporting")})).mutation(async({ctx,input})=>{await(await service(ctx,input.projectId)).linkQuestion(input.projectId,input.itemId,input.questionVersionId,input.relationship);return{success:true as const};}),
  graph:operatorAdminProcedure.input(project).query(async({ctx,input})=>(await service(ctx,input.projectId)).graph(input.projectId)),
  gaps:operatorAdminProcedure.input(project).query(async({ctx,input})=>(await service(ctx,input.projectId)).gaps(input.projectId)),
});
