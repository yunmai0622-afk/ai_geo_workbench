import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { extractProfileForQuestionGeneration } from "@shared/geoProfileQuestionMapping";
import { T0_DEFAULT_PLATFORMS } from "@shared/t0DiagnosisDisplay";
import { resolveQuestionLastTestResult } from "@shared/testRoundComparison";
import { isSyntheticGeoRawAnswer } from "@shared/geoSyntheticResponse";
import {
  aiResponses,
  aiTestRuns,
  enterpriseGeoProfiles,
  projects,
  questions,
  roundQuestions,
  testRounds,
  type TestRound,
} from "../drizzle/schema";
import {
  askEngine,
  getAiEngineDisplayName,
  normalizePlatformToAiEngine,
  type AiEngine,
} from "./geoAiMentionCheck";
import { enrichAnswerAnalysis } from "./geoAiMentionEvidence";
import type { DbConn } from "./projectAccess";
import { extractFromResponse } from "./services/responseExtractionService";

const QUESTION_POOL_ROUND_NAME = "问题池多平台实测";
const QUESTION_POOL_SCHEDULED_TYPE = "manual";

function engineToAiPlatform(engine: AiEngine): "豆包" | "DeepSeek" | "Kimi" | "通义" | "文心" {
  const map: Record<AiEngine, "豆包" | "DeepSeek" | "Kimi" | "通义" | "文心"> = {
    doubao: "豆包",
    deepseek: "DeepSeek",
    kimi: "Kimi",
    qwen: "通义",
    wenxin: "文心",
  };
  return map[engine];
}

async function loadProjectProfile(db: DbConn, projectId: number) {
  const [projectRows, profileRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    db
      .select()
      .from(enterpriseGeoProfiles)
      .where(eq(enterpriseGeoProfiles.projectId, projectId))
      .orderBy(desc(enterpriseGeoProfiles.updatedAt))
      .limit(1),
  ]);
  const project = projectRows[0];
  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "企业项目不存在" });
  }
  const profile = profileRows[0] ?? null;
  const mapped = extractProfileForQuestionGeneration({
    profile: profile as Record<string, unknown> | null,
    project,
  });
  return { project, profile, mapped };
}

export type QuestionPoolTestSummary = {
  enabledQuestionCount: number;
  lastQuestionPoolTestAt: string | null;
  lastQuestionPoolRoundId: string | null;
  runningRoundId: string | null;
};

export async function getQuestionPoolTestSummary(
  db: DbConn,
  projectId: number,
): Promise<QuestionPoolTestSummary> {
  const [enabledRows, roundRows, runningRows] = await Promise.all([
    db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.projectId, projectId), eq(questions.enabled, 1))),
    db
      .select({
        id: testRounds.id,
        finishedAt: testRounds.finishedAt,
        status: testRounds.status,
      })
      .from(testRounds)
      .where(and(eq(testRounds.projectId, projectId), eq(testRounds.scheduledType, QUESTION_POOL_SCHEDULED_TYPE)))
      .orderBy(desc(testRounds.finishedAt), desc(testRounds.createdAt)),
    db
      .select({ id: testRounds.id })
      .from(testRounds)
      .where(
        and(
          eq(testRounds.projectId, projectId),
          eq(testRounds.scheduledType, QUESTION_POOL_SCHEDULED_TYPE),
          eq(testRounds.status, "running"),
        ),
      )
      .limit(1),
  ]);

  const completed = roundRows.find(row => row.status === "completed" && row.finishedAt);
  return {
    enabledQuestionCount: enabledRows.length,
    lastQuestionPoolTestAt: completed?.finishedAt?.toISOString() ?? null,
    lastQuestionPoolRoundId: completed?.id ?? null,
    runningRoundId: runningRows[0]?.id ?? null,
  };
}

export type StartQuestionPoolTestResult =
  | { roundId: string; status: "running" }
  | { error: "ALREADY_RUNNING" };

export async function startQuestionPoolTest(
  db: DbConn,
  projectId: number,
  platforms: string[] = [...T0_DEFAULT_PLATFORMS],
): Promise<StartQuestionPoolTestResult> {
  const summary = await getQuestionPoolTestSummary(db, projectId);
  if (summary.runningRoundId) {
    return { error: "ALREADY_RUNNING" };
  }

  const enabledQuestions = await db
    .select()
    .from(questions)
    .where(and(eq(questions.projectId, projectId), eq(questions.enabled, 1)));
  if (enabledQuestions.length === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "当前项目没有启用的问题，请先在问题库中启用题目",
    });
  }

  const normalizedPlatforms = platforms.length > 0 ? platforms : [...T0_DEFAULT_PLATFORMS];
  const roundId = randomUUID();
  await db.insert(testRounds).values({
    id: roundId,
    projectId,
    roundType: "T0_BASELINE",
    roundName: QUESTION_POOL_ROUND_NAME,
    status: "pending",
    platforms: normalizedPlatforms,
    questionsCount: enabledQuestions.length,
    runsPerQuestion: 1,
    sourceQuestionPoolSize: enabledQuestions.length,
    platformsIncluded: normalizedPlatforms,
    scheduledType: QUESTION_POOL_SCHEDULED_TYPE,
    comparedToRoundId: summary.lastQuestionPoolRoundId,
  });

  await db.insert(roundQuestions).values(
    enabledQuestions.map(question => ({
      id: randomUUID(),
      roundId,
      questionId: question.id,
    })),
  );

  const startedAt = new Date();
  const lockResult = await db
    .update(testRounds)
    .set({ status: "running", startedAt })
    .where(and(eq(testRounds.id, roundId), eq(testRounds.status, "pending")));
  const affectedRows =
    typeof lockResult === "object" && lockResult !== null && "affectedRows" in lockResult
      ? Number((lockResult as { affectedRows: number }).affectedRows)
      : 0;
  if (affectedRows === 0) {
    return { error: "ALREADY_RUNNING" };
  }

  void runQuestionPoolTestBackground(db, roundId).catch(err => {
    console.error("[question-pool-test] background failed", roundId, err);
  });

  return { roundId, status: "running" };
}

type QuestionAggregate = {
  mentioned: boolean;
  recommended: boolean;
  competitors: Set<string>;
};

async function updateQuestionAfterPoolTest(
  db: DbConn,
  projectId: number,
  questionId: number,
  aggregate: QuestionAggregate,
): Promise<void> {
  const competitors = [...aggregate.competitors];
  await db
    .update(questions)
    .set({
      lastTestResult: resolveQuestionLastTestResult(
        aggregate.mentioned,
        aggregate.recommended,
        competitors,
      ),
      lastTestedAt: new Date(),
    })
    .where(and(eq(questions.id, questionId), eq(questions.projectId, projectId)));
}

export async function runQuestionPoolTestBackground(db: DbConn, roundId: string): Promise<void> {
  const roundRows = await db.select().from(testRounds).where(eq(testRounds.id, roundId)).limit(1);
  const round = roundRows[0];
  if (!round) return;

  const boundRows = await db
    .select({ questionId: roundQuestions.questionId })
    .from(roundQuestions)
    .where(eq(roundQuestions.roundId, roundId));
  const questionIds = boundRows.map(row => row.questionId);
  const platforms = round.platformsIncluded ?? round.platforms ?? [...T0_DEFAULT_PLATFORMS];

  const { profile, mapped } = await loadProjectProfile(db, round.projectId);
  const enterpriseName = mapped.brandName || profile?.enterpriseName || "";
  const shortName = typeof profile?.shortName === "string" ? profile.shortName : undefined;
  const competitorNames = mapped.competitors ?? [];

  const questionRows =
    questionIds.length > 0
      ? await db
          .select()
          .from(questions)
          .where(and(eq(questions.projectId, round.projectId), eq(questions.enabled, 1)))
      : [];
  const questionById = new Map(questionRows.map(question => [question.id, question]));
  const aggregates = new Map<number, QuestionAggregate>();

  try {
    for (const questionId of questionIds) {
      const question = questionById.get(questionId);
      if (!question) continue;
      const aggregate: QuestionAggregate = {
        mentioned: false,
        recommended: false,
        competitors: new Set<string>(),
      };

      for (const platform of platforms) {
        const engine = normalizePlatformToAiEngine(platform);
        if (!engine) continue;

        const answer = await askEngine(engine, question.questionText);
        if (!answer?.trim() || isSyntheticGeoRawAnswer(answer)) {
          continue;
        }

        const extracted = extractFromResponse(answer, enterpriseName, competitorNames);
        const enriched = enrichAnswerAnalysis(
          answer,
          enterpriseName,
          shortName,
          competitorNames,
          engine,
          getAiEngineDisplayName(engine),
          question.questionText,
        );
        const competitorNamesListed = enriched.competitorMentions.filter(item => item.mentioned).map(item => item.name);
        const testedAt = new Date();

        await db.insert(aiTestRuns).values({
          id: randomUUID(),
          projectId: round.projectId,
          roundId,
          questionId,
          platform,
          runIndex: 1,
          testedAt,
          rawAnswer: answer,
          mentionedCompany: extracted.mentioned,
          recommendedCompany: extracted.recommended,
          descriptionAccurate: null,
          competitorMentioned: extracted.competitors.length > 0 || competitorNamesListed.length > 0,
          competitorNames: [...new Set([...extracted.competitors, ...competitorNamesListed])],
          hasSourceLinks: extracted.citations.length > 0,
          sourceLinks: extracted.citations.length > 0 ? extracted.citations : null,
          suspectedContentClues: null,
          manualNote: null,
          screenshotUrl: null,
        });

        await db.insert(aiResponses).values({
          projectId: round.projectId,
          questionId,
          questionText: question.questionText,
          aiPlatform: engineToAiPlatform(engine),
          rawAnswer: answer,
          checkedAt: testedAt,
          extractedMentioned: extracted.mentioned,
          extractedRecommended: extracted.recommended,
          extractedCitations: extracted.citations,
          extractedCompetitors: extracted.competitors,
          extractedSentiment: extracted.sentiment,
          extractionMethod: "rule",
          extractedAt: testedAt,
          questionPoolType: question.searchPoolType ?? null,
        });

        if (extracted.mentioned) aggregate.mentioned = true;
        if (extracted.recommended) aggregate.recommended = true;
        for (const name of extracted.competitors) aggregate.competitors.add(name);
      }

      aggregates.set(questionId, aggregate);
      await updateQuestionAfterPoolTest(db, round.projectId, questionId, aggregate);
    }

    await db
      .update(testRounds)
      .set({ status: "completed", finishedAt: new Date() })
      .where(eq(testRounds.id, roundId));
  } catch (err) {
    await db
      .update(testRounds)
      .set({ status: "failed", finishedAt: new Date() })
      .where(eq(testRounds.id, roundId));
    throw err;
  }
}

export function isQuestionPoolTestRound(round: Pick<TestRound, "scheduledType" | "roundName">): boolean {
  return round.scheduledType === QUESTION_POOL_SCHEDULED_TYPE || round.roundName === QUESTION_POOL_ROUND_NAME;
}
