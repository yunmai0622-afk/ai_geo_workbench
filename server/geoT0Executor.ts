import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { extractProfileForQuestionGeneration } from "@shared/geoProfileQuestionMapping";
import { evaluateProfileReadinessForT0 } from "@shared/geoProfileP0Readiness";
import { isSyntheticGeoRawAnswer } from "@shared/geoSyntheticResponse";
import {
  aiTestRuns,
  enterpriseGeoProfiles,
  projects,
  questions,
  roundQuestions,
  testRounds,
  type AiTestRun,
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

export type T0RunTask = {
  questionId: number;
  platform: string;
  runIndex: number;
};

export type ExecuteT0RunResult =
  | { ok: true; record: AiTestRun }
  | { ok: false; error: string };

export type CreateT0WithQuestionsInput = {
  projectId: number;
  roundName?: string;
  platforms: string[];
  runsPerQuestion?: number;
  questionIds?: number[];
};

export type CreateT0WithQuestionsResult = {
  round: TestRound;
  boundQuestionCount: number;
};

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

export async function createT0RoundWithQuestions(
  db: DbConn,
  input: CreateT0WithQuestionsInput,
): Promise<CreateT0WithQuestionsResult> {
  const { project, profile, mapped } = await loadProjectProfile(db, input.projectId);

  const readiness = evaluateProfileReadinessForT0({
    profile: profile as Record<string, unknown> | null,
    project,
  });
  if (!readiness.ready) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `企业资料未满足 T0 基线检测要求，请先补全：${readiness.missingLabels.join("、")}`,
    });
  }

  const runningRows = await db
    .select({ id: testRounds.id })
    .from(testRounds)
    .where(
      and(
        eq(testRounds.projectId, input.projectId),
        eq(testRounds.roundType, "T0_BASELINE"),
        eq(testRounds.status, "running"),
      ),
    )
    .limit(1);
  if (runningRows[0]) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "当前项目已有进行中的 T0 基线检测，请等待完成后再创建",
    });
  }

  let questionIds = input.questionIds ?? [];
  if (questionIds.length === 0) {
    const enabledRows = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.projectId, input.projectId), eq(questions.enabled, 1)));
    questionIds = enabledRows.map(r => r.id);
  } else {
    const rows = await db
      .select({ id: questions.id, projectId: questions.projectId })
      .from(questions)
      .where(and(eq(questions.projectId, input.projectId), inArray(questions.id, questionIds)));
    if (rows.length !== questionIds.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "部分问题不存在或不属于当前项目" });
    }
  }

  if (questionIds.length === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "当前项目没有可用问题，请先生成或启用问题后再创建 T0 轮次",
    });
  }

  const roundId = randomUUID();
  const runsPerQuestion = input.runsPerQuestion ?? 3;
  const roundName = input.roundName?.trim() || "T0 基线检测";

  await db.insert(testRounds).values({
    id: roundId,
    projectId: input.projectId,
    roundType: "T0_BASELINE",
    roundName,
    status: "pending",
    platforms: input.platforms,
    questionsCount: questionIds.length,
    runsPerQuestion,
  });

  await db.insert(roundQuestions).values(
    questionIds.map(questionId => ({
      id: randomUUID(),
      roundId,
      questionId,
    })),
  );

  const roundRows = await db.select().from(testRounds).where(eq(testRounds.id, roundId)).limit(1);
  const round = roundRows[0];
  if (!round) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建 T0 轮次失败" });
  }

  return { round, boundQuestionCount: questionIds.length };
}

export async function executeT0Run(
  db: DbConn,
  input: {
    projectId: number;
    roundId: string;
    questionId: number;
    platform: string;
    runIndex: number;
  },
): Promise<ExecuteT0RunResult> {
  const engine = normalizePlatformToAiEngine(input.platform);
  if (!engine) {
    return { ok: false, error: `不支持的平台：${input.platform}` };
  }

  const questionRows = await db
    .select()
    .from(questions)
    .where(and(eq(questions.id, input.questionId), eq(questions.projectId, input.projectId)))
    .limit(1);
  const question = questionRows[0];
  if (!question) {
    return { ok: false, error: "问题不存在或不属于当前项目" };
  }

  const { profile, mapped } = await loadProjectProfile(db, input.projectId);
  const enterpriseName = mapped.brandName || profile?.enterpriseName || "";
  const shortName = typeof profile?.shortName === "string" ? profile.shortName : undefined;

  if (!enterpriseName.trim()) {
    return { ok: false, error: "企业名称缺失，无法执行实测" };
  }

  try {
    const answer = await askEngine(engine, question.questionText);
    if (!answer?.trim()) {
      return { ok: false, error: `${getAiEngineDisplayName(engine)} 未返回有效回答` };
    }
    if (isSyntheticGeoRawAnswer(answer)) {
      return { ok: false, error: "实测回答无效：检测到系统占位内容" };
    }

    const enriched = enrichAnswerAnalysis(
      answer,
      enterpriseName,
      shortName,
      mapped.competitors,
      engine,
      getAiEngineDisplayName(engine),
      question.questionText,
    );

    const competitorNamesListed = enriched.competitorMentions.filter(c => c.mentioned).map(c => c.name);
    const testedAt = new Date(enriched.testedAt);

    const id = randomUUID();
    await db.insert(aiTestRuns).values({
      id,
      projectId: input.projectId,
      roundId: input.roundId,
      questionId: input.questionId,
      platform: input.platform,
      runIndex: input.runIndex,
      testedAt,
      rawAnswer: answer,
      mentionedCompany: enriched.mentionedBrand ?? enriched.mentionsBrand ?? false,
      recommendedCompany: enriched.recommendedBrand ?? enriched.recommendsBrand ?? false,
      descriptionAccurate: null,
      competitorMentioned: competitorNamesListed.length > 0,
      competitorNames: competitorNamesListed,
      hasSourceLinks: (enriched.citedUrls?.length ?? 0) > 0,
      sourceLinks: enriched.citedUrls?.length ? enriched.citedUrls : null,
      suspectedContentClues: null,
      manualNote: null,
      screenshotUrl: null,
    });

    const inserted = await db.select().from(aiTestRuns).where(eq(aiTestRuns.id, id)).limit(1);
    const record = inserted[0];
    if (!record) {
      return { ok: false, error: "写入实测记录失败" };
    }
    return { ok: true, record };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

function buildT0TaskQueue(round: TestRound, boundQuestionIds: number[]): T0RunTask[] {
  const platforms = round.platforms ?? [];
  const runsPerQuestion = round.runsPerQuestion ?? 3;
  const tasks: T0RunTask[] = [];
  for (const questionId of boundQuestionIds) {
    for (const platform of platforms) {
      for (let runIndex = 1; runIndex <= runsPerQuestion; runIndex += 1) {
        tasks.push({ questionId, platform, runIndex });
      }
    }
  }
  return tasks;
}

export type StartT0ExecutionResult = {
  roundId: string;
  completedRuns: number;
  failedRuns: number;
  failures: Array<{ questionId: number; platform: string; runIndex: number; error: string }>;
};

export async function startT0Execution(db: DbConn, roundId: string): Promise<StartT0ExecutionResult> {
  const roundRows = await db.select().from(testRounds).where(eq(testRounds.id, roundId)).limit(1);
  const round = roundRows[0];
  if (!round) {
    throw new TRPCError({ code: "NOT_FOUND", message: "检测轮次不存在" });
  }
  if (round.roundType !== "T0_BASELINE") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "仅 T0 基线轮次可执行此操作" });
  }
  if (round.status !== "pending") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `当前轮次状态为 ${round.status}，仅 pending 状态可开始执行`,
    });
  }

  const boundRows = await db
    .select({ questionId: roundQuestions.questionId })
    .from(roundQuestions)
    .where(eq(roundQuestions.roundId, roundId));
  const boundQuestionIds = boundRows.map(r => r.questionId);
  if (boundQuestionIds.length === 0) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "该轮次未绑定任何问题" });
  }

  const startedAt = new Date();
  await db
    .update(testRounds)
    .set({ status: "running", startedAt })
    .where(eq(testRounds.id, roundId));

  const tasks = buildT0TaskQueue(round, boundQuestionIds);
  let completedRuns = 0;
  let failedRuns = 0;
  const failures: StartT0ExecutionResult["failures"] = [];

  for (const task of tasks) {
    const result = await executeT0Run(db, {
      projectId: round.projectId,
      roundId,
      questionId: task.questionId,
      platform: task.platform,
      runIndex: task.runIndex,
    });
    if (result.ok) {
      completedRuns += 1;
    } else {
      failedRuns += 1;
      failures.push({
        questionId: task.questionId,
        platform: task.platform,
        runIndex: task.runIndex,
        error: result.error,
      });
    }
  }

  const finishedAt = new Date();
  const finalStatus = failedRuns > 0 && completedRuns === 0 ? "failed" : "completed";
  await db
    .update(testRounds)
    .set({ status: finalStatus, finishedAt })
    .where(eq(testRounds.id, roundId));

  return { roundId, completedRuns, failedRuns, failures };
}
