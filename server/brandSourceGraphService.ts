import { and, eq, inArray, notInArray } from "drizzle-orm";
import {
  brandSourceRecords,
  customerCases,
  enterpriseGeoProfiles,
  entityAnchors,
  entityConsistencyChecks,
  optimizationTasks,
  questions,
  sourceEnhancementSuggestions,
} from "../drizzle/schema";
import {
  buildPersistedEnhancementSuggestions,
  computeEntityConsistencyChecks,
  deriveBrandSourceRisk,
  extractEnterpriseProfileStandard,
  normalizeBrandSourceRecord,
  resolveEnhancementTaskType,
  type BrandSourceRecordRow,
  type EntityConsistencyCheckResult,
} from "@shared/brandSourceGraph";
import type { DbConn } from "./projectAccess";
import { filterRowsWithNumericId } from "./trpcRowSanitize";

export async function loadBrandSourceGraphContext(db: DbConn, projectId: number) {
  const [records, profileRows, anchorRows, caseRows, questionRows] = await Promise.all([
    db.select().from(brandSourceRecords).where(eq(brandSourceRecords.projectId, projectId)),
    db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, projectId)).limit(1),
    db.select().from(entityAnchors).where(eq(entityAnchors.projectId, projectId)).limit(1),
    db.select({ customerName: customerCases.customerName }).from(customerCases).where(eq(customerCases.projectId, projectId)),
    db.select().from(questions).where(eq(questions.projectId, projectId)),
  ]);

  const standard = extractEnterpriseProfileStandard({
    profile: profileRows[0] ?? null,
    entityAnchor: anchorRows[0] ?? null,
    customerCaseNames: caseRows.map(row => row.customerName).filter(Boolean),
  });

  return {
    records: records.map(row => normalizeBrandSourceRecord(row as BrandSourceRecordRow)),
    standard,
    questions: filterRowsWithNumericId(questionRows),
  };
}

export async function syncSourceGraphDerivedData(db: DbConn, projectId: number) {
  const { records, standard, questions } = await loadBrandSourceGraphContext(db, projectId);

  for (const record of records) {
    const risk = deriveBrandSourceRisk(record);
    if (record.riskLevel !== risk.riskLevel || record.riskNotes !== risk.riskNotes) {
      await db
        .update(brandSourceRecords)
        .set({ riskLevel: risk.riskLevel, riskNotes: risk.riskNotes })
        .where(and(eq(brandSourceRecords.id, record.id), eq(brandSourceRecords.projectId, projectId)));
      record.riskLevel = risk.riskLevel;
      record.riskNotes = risk.riskNotes;
    }
  }

  const checks = computeEntityConsistencyChecks(records, standard);
  await db.delete(entityConsistencyChecks).where(eq(entityConsistencyChecks.projectId, projectId));
  if (checks.length > 0) {
    await db.insert(entityConsistencyChecks).values(
      checks.map(check => ({
        projectId,
        anchorType: check.anchorType,
        standardValue: check.standardValue === "—" ? null : check.standardValue,
        observedValues: check.observedValues,
        status: check.status,
        score: check.score,
        issueSummary: check.issueSummary,
        suggestion: check.suggestion,
      })),
    );
  }

  const existingSuggestions = await db
    .select()
    .from(sourceEnhancementSuggestions)
    .where(eq(sourceEnhancementSuggestions.projectId, projectId));

  const preserved = existingSuggestions.filter(item =>
    ["content_task_created", "accepted", "verified"].includes(item.status),
  );
  const preservedKeys = new Set(
    preserved.map(item => `${item.gapType}:${item.targetPlatform ?? "all"}`),
  );

  const drafts = buildPersistedEnhancementSuggestions({ records, standard, checks, questions }).filter(
    draft => !preservedKeys.has(draft.suggestionKey),
  );

  const removableIds = existingSuggestions
    .filter(item => item.status === "pending" || item.status === "ignored")
    .map(item => item.id);
  if (removableIds.length > 0) {
    await db
      .delete(sourceEnhancementSuggestions)
      .where(
        and(
          eq(sourceEnhancementSuggestions.projectId, projectId),
          inArray(sourceEnhancementSuggestions.id, removableIds),
        ),
      );
  }

  if (drafts.length > 0) {
    await db.insert(sourceEnhancementSuggestions).values(
      drafts.map(draft => ({
        projectId,
        suggestionTitle: draft.suggestionTitle,
        gapType: draft.gapType,
        targetPlatform: draft.targetPlatform,
        targetKeywords: draft.targetKeywords,
        contentDirection: draft.contentDirection,
        priority: draft.priority,
        status: "pending" as const,
      })),
    );
  }

  return { checks, preservedCount: preserved.length, createdCount: drafts.length };
}

export async function createOptimizationTaskFromSuggestion(
  db: DbConn,
  projectId: number,
  suggestionId: number,
): Promise<{ taskId: number; alreadyExists: boolean }> {
  const rows = await db
    .select()
    .from(sourceEnhancementSuggestions)
    .where(and(eq(sourceEnhancementSuggestions.id, suggestionId), eq(sourceEnhancementSuggestions.projectId, projectId)))
    .limit(1);
  const suggestion = rows[0];
  if (!suggestion) {
    throw new Error("增强建议不存在");
  }
  if (suggestion.linkedTaskId) {
    const taskRows = await db
      .select({ id: optimizationTasks.id })
      .from(optimizationTasks)
      .where(and(eq(optimizationTasks.id, suggestion.linkedTaskId), eq(optimizationTasks.projectId, projectId)))
      .limit(1);
    if (taskRows[0]) {
      return { taskId: taskRows[0].id, alreadyExists: true };
    }
  }

  const taskType = resolveEnhancementTaskType(suggestion.gapType);
  const marker = `[source-graph:${suggestion.id}]`;
  const insertResult = await db.insert(optimizationTasks).values({
    projectId,
    taskType,
    taskName: suggestion.suggestionTitle.slice(0, 255),
    priority: suggestion.priority,
    generationReason: `${suggestion.contentDirection} ${marker}`,
    executionSuggestion: suggestion.contentDirection,
    expectedImpact: "增强品牌信源一致性，提升 AI 识别与引用稳定性。",
    status: "todo",
  });
  const taskId = Number(insertResult[0]?.insertId);
  if (!taskId) {
    throw new Error("创建内容任务失败");
  }

  await db
    .update(sourceEnhancementSuggestions)
    .set({ linkedTaskId: taskId, status: "content_task_created" })
    .where(and(eq(sourceEnhancementSuggestions.id, suggestionId), eq(sourceEnhancementSuggestions.projectId, projectId)));

  return { taskId, alreadyExists: false };
}

export function mapConsistencyChecksFromDb(
  rows: Array<{
    anchorType: EntityConsistencyCheckResult["anchorType"];
    standardValue: string | null;
    observedValues: string[] | null;
    status: EntityConsistencyCheckResult["status"];
    score: number;
    issueSummary: string | null;
    suggestion: string | null;
  }>,
): EntityConsistencyCheckResult[] {
  return rows.map(row => {
    const meta = row.anchorType;
    const label =
      [
        { value: "brand_name", label: "品牌名称" },
        { value: "company_name", label: "公司名称" },
        { value: "main_business", label: "主营业务" },
        { value: "target_customer", label: "目标客户" },
        { value: "core_product", label: "核心产品/服务" },
        { value: "official_url", label: "官网链接" },
        { value: "target_keywords", label: "核心关键词" },
        { value: "customer_proof", label: "客户案例/背书" },
      ].find(item => item.value === meta)?.label ?? meta;
    return {
      anchorType: row.anchorType,
      anchorLabel: label,
      standardValue: row.standardValue ?? "—",
      observedValues: row.observedValues ?? [],
      status: row.status,
      score: row.score,
      issueSummary: row.issueSummary ?? "",
      suggestion: row.suggestion ?? "",
    };
  });
}

export async function listActiveEnhancementSuggestions(db: DbConn, projectId: number) {
  return db
    .select()
    .from(sourceEnhancementSuggestions)
    .where(
      and(
        eq(sourceEnhancementSuggestions.projectId, projectId),
        notInArray(sourceEnhancementSuggestions.status, ["ignored"]),
      ),
    );
}
