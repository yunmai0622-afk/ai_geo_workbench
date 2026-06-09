import { eq } from "drizzle-orm";
import {
  brandSourceRecords,
  customerCases,
  trustEvidenceItems,
  entityAnchors,
  enterpriseGeoProfiles,
  questions,
} from "../drizzle/schema";
import {
  evaluateOnboardingWizardCompleteness,
  type OnboardingWizardCompleteness,
} from "@shared/onboardingWizardCompleteness";
import {
  buildOnboardingCompletenessReport,
  type OnboardingCompletenessReport,
} from "@shared/onboardingCompletenessReport";
import {
  mergeGeoGoalNotesPayload,
  parseGeoGoalNotesPayload,
  type QuestionGuideExamples,
} from "@shared/onboardingWizardGeoGoalNotes";
import {
  mapSearchPoolTypeToLegacyQuestionType,
  type SearchPoolQuestionType,
} from "@shared/questionSearchPool";
import type { getDb } from "./db";

type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

function normalizeQuestionText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

const GUIDE_POOL_MAPPINGS: Array<{
  key: keyof QuestionGuideExamples;
  searchPoolType: string;
}> = [
  { key: "brandSearch", searchPoolType: "brand_search" },
  { key: "categoryRecommend", searchPoolType: "category_recommend" },
  { key: "sceneNeed", searchPoolType: "scene_need" },
  { key: "comparison", searchPoolType: "comparison" },
  { key: "longTail", searchPoolType: "long_tail" },
];

export type ProfileUpsertLike = Record<string, unknown> & {
  projectId: number;
  enterpriseName?: string;
  brandName?: string | null;
  productDesc?: string | null;
  productServiceIntro?: string | null;
  targetCustomer?: string | null;
  targetCustomers?: string | null;
  keywords?: string[] | null;
  officialWebsite?: string | null;
  wizardStep?: number;
  geoGoalNotes?: string | null;
};

async function loadWizardCompletenessRawContext(db: DbClient, projectId: number) {
  const [questionRows, caseRows, trustEvidenceRows, sourceRows] = await Promise.all([
    db.select({ id: questions.id }).from(questions).where(eq(questions.projectId, projectId)),
    db.select({ id: customerCases.id }).from(customerCases).where(eq(customerCases.projectId, projectId)),
    db
      .select({
        id: trustEvidenceItems.id,
        verificationStatus: trustEvidenceItems.verificationStatus,
      })
      .from(trustEvidenceItems)
      .where(eq(trustEvidenceItems.projectId, projectId)),
    db
      .select({ platform: brandSourceRecords.platform })
      .from(brandSourceRecords)
      .where(eq(brandSourceRecords.projectId, projectId)),
  ]);
  const platforms = [...new Set(sourceRows.map(r => r.platform).filter(Boolean))] as string[];
  const verifiedTrustEvidenceCount = trustEvidenceRows.filter(row => row.verificationStatus === "verified").length;
  return {
    questionCount: questionRows.length,
    customerCaseCount: caseRows.length,
    trustEvidenceCount: trustEvidenceRows.length,
    verifiedTrustEvidenceCount,
    brandSourceCount: sourceRows.length,
    brandSourcePlatforms: platforms,
  };
}

export async function loadWizardCompletenessContext(
  db: DbClient,
  projectId: number,
  profile: Record<string, unknown> | null,
): Promise<OnboardingWizardCompleteness> {
  const ctx = await loadWizardCompletenessRawContext(db, projectId);
  return evaluateOnboardingWizardCompleteness({
    profile,
    questionCount: ctx.questionCount,
    customerCaseCount: ctx.customerCaseCount,
    trustEvidenceCount: ctx.trustEvidenceCount,
    brandSourceCount: ctx.brandSourceCount,
    brandSourcePlatformCount: ctx.brandSourcePlatforms.length,
  });
}

export async function loadOnboardingCompletenessReport(
  db: DbClient,
  projectId: number,
): Promise<OnboardingCompletenessReport> {
  const profiles = await db
    .select()
    .from(enterpriseGeoProfiles)
    .where(eq(enterpriseGeoProfiles.projectId, projectId))
    .limit(1);
  const profile = profiles[0] ?? null;
  const ctx = await loadWizardCompletenessRawContext(db, projectId);
  const questionGuide = parseGeoGoalNotesPayload(profile?.geoGoalNotes ?? null).questionGuide;
  return buildOnboardingCompletenessReport({
    profile,
    questionCount: ctx.questionCount,
    customerCaseCount: ctx.customerCaseCount,
    trustEvidenceCount: ctx.trustEvidenceCount,
    verifiedTrustEvidenceCount: ctx.verifiedTrustEvidenceCount,
    brandSourceCount: ctx.brandSourceCount,
    brandSourcePlatforms: ctx.brandSourcePlatforms,
    questionGuide,
    wizardStep: profile?.wizardStep,
    lastUpdatedAt: profile?.updatedAt,
  });
}

export async function syncEntityAnchorsFromOnboardingWizard(db: DbClient, input: ProfileUpsertLike) {
  const projectId = input.projectId;
  const existing = await db.select().from(entityAnchors).where(eq(entityAnchors.projectId, projectId)).limit(1);
  if (existing[0]?.manualOverride) {
    return { skipped: true as const, reason: "manualOverride" };
  }

  const brandName = String(input.brandName ?? "").trim();
  const companyName = String(input.enterpriseName ?? "").trim();
  const coreBusiness = String(input.productDesc ?? input.productServiceIntro ?? "").trim();
  const targetCustomer = String(input.targetCustomer ?? input.targetCustomers ?? "").trim();
  const keywords = Array.isArray(input.keywords) ? input.keywords.map(s => String(s).trim()).filter(Boolean) : [];
  const officialSite = String(input.officialWebsite ?? "").trim();
  const now = new Date();

  const patch = {
    brandName: brandName || null,
    companyName: companyName || null,
    coreBusiness: coreBusiness || null,
    targetCustomer: targetCustomer || null,
    coreKeywords: keywords,
    officialSite: officialSite || null,
    lastSyncedFrom: "onboarding_wizard",
    lastSyncedAt: now,
  };

  if (existing[0]) {
    await db.update(entityAnchors).set(patch).where(eq(entityAnchors.id, existing[0].id));
    return { skipped: false as const, updated: true };
  }

  await db.insert(entityAnchors).values({
    projectId,
    ...patch,
    founderName: null,
    typicalCases: null,
    manualOverride: false,
  });
  return { skipped: false as const, created: true };
}

export async function syncQuestionsFromWizardGuide(
  db: DbClient,
  projectId: number,
  guide: QuestionGuideExamples,
) {
  const existingRows = await db
    .select({ questionText: questions.questionText })
    .from(questions)
    .where(eq(questions.projectId, projectId));
  const known = new Set(existingRows.map(r => normalizeQuestionText(r.questionText)));
  const toInsert: Array<typeof questions.$inferInsert> = [];

  for (const mapping of GUIDE_POOL_MAPPINGS) {
    const examples = guide[mapping.key] ?? [];
    const questionType = mapSearchPoolTypeToLegacyQuestionType(
      mapping.searchPoolType as SearchPoolQuestionType,
    ) as typeof questions.$inferInsert["questionType"];
    for (const raw of examples) {
      const questionText = normalizeQuestionText(raw);
      if (!questionText || known.has(questionText)) continue;
      known.add(questionText);
      toInsert.push({
        projectId,
        questionText,
        questionType,
        targetKeyword: null,
        intentLevel: "高",
        businessValue: 5,
        source: "onboarding_wizard",
        enabled: 1,
        searchPoolType: mapping.searchPoolType,
      });
    }
  }

  if (toInsert.length > 0) {
    await db.insert(questions).values(toInsert);
  }
  return { addedCount: toInsert.length };
}

export function buildGeoGoalNotesForUpsert(
  existingRaw: string | null | undefined,
  patch: { goalNotes?: string; questionGuide?: QuestionGuideExamples },
): string | null | undefined {
  if (patch.goalNotes === undefined && patch.questionGuide === undefined) return undefined;
  return mergeGeoGoalNotesPayload(existingRaw, patch);
}

export async function finalizeProfileUpsert(
  db: DbClient,
  projectId: number,
  input: ProfileUpsertLike,
  existingGeoGoalNotes: string | null | undefined,
) {
  const wizardStep = typeof input.wizardStep === "number" ? input.wizardStep : undefined;
  const shouldSyncAnchors = wizardStep === 1 || wizardStep === 2;
  const anchorResult = shouldSyncAnchors ? await syncEntityAnchorsFromOnboardingWizard(db, input) : null;

  const payload = parseGeoGoalNotesPayload(existingGeoGoalNotes ?? input.geoGoalNotes);
  const questionGuide = payload.questionGuide;
  const questionSync =
    wizardStep === 4 && questionGuide
      ? await syncQuestionsFromWizardGuide(db, projectId, questionGuide)
      : { addedCount: 0 };

  const profiles = await db
    .select()
    .from(enterpriseGeoProfiles)
    .where(eq(enterpriseGeoProfiles.projectId, projectId))
    .limit(1);
  const profile = profiles[0] ?? null;
  const completeness = await loadWizardCompletenessContext(db, projectId, profile);

  if (profile) {
    const wizardCompletedAt =
      wizardStep === 8 && completeness.completionScore >= 60 ? new Date() : profile.wizardCompletedAt;
    await db
      .update(enterpriseGeoProfiles)
      .set({
        completionScore: completeness.completionScore,
        wizardCompletedAt,
      })
      .where(eq(enterpriseGeoProfiles.id, profile.id));
  }

  return { anchorResult, questionSync, completeness };
}
