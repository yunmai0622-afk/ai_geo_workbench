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
import { syncCompetitorAiMentionCounts } from "./competitorAnalysis";
import { emitT0CompleteNotification } from "./systemNotifications";
import { applyT0QuestionGapTagsForRound } from "./t0QuestionGapTags";

const activeT0Executions = new Set<string>();

function buildT0RunTaskKey(questionId: number, platform: string, runIndex: number): string {
  return `${questionId}:${platform}:${runIndex}`;
}

async function loadCompletedT0TaskKeys(db: DbConn, roundId: string): Promise<Set<string>> {
  const rows = await db
    .select({
      questionId: aiTestRuns.questionId,
      platform: aiTestRuns.platform,
      runIndex: aiTestRuns.runIndex,
    })
    .from(aiTestRuns)
    .where(eq(aiTestRuns.roundId, roundId));
  return new Set(rows.map(row => buildT0RunTaskKey(row.questionId, row.platform, row.runIndex)));
}

async function finalizeT0RoundIfComplete(
  db: DbConn,
  round: TestRound,
  roundId: string,
  state: Pick<StartT0ExecutionSuccess, "completedRuns" | "failedRuns" | "failures">,
  existingCompletedCount: number,
): Promise<StartT0ExecutionSuccess | null> {
  const boundRows = await db
    .select({ questionId: roundQuestions.questionId })
    .from(roundQuestions)
    .where(eq(roundQuestions.roundId, roundId));
  const boundQuestionIds = boundRows.map(row => row.questionId);
  const platforms = round.platforms ?? [];
  const runsPerQuestion = round.runsPerQuestion ?? 3;
  const expectedTotal = boundQuestionIds.length * runsPerQuestion * platforms.length;
  const totalCompleted = existingCompletedCount + state.completedRuns;
  if (expectedTotal <= 0 || totalCompleted < expectedTotal) {
    return null;
  }

  const finishedAt = new Date();
  const finalStatus = totalCompleted > 0 ? "completed" : "failed";
  await db
    .update(testRounds)
    .set({ status: finalStatus, finishedAt })
    .where(eq(testRounds.id, roundId));

  if (finalStatus === "completed") {
    try {
      await syncCompetitorAiMentionCounts(db, round.projectId);
    } catch (err) {
      console.warn("[t0-execution] competitor mention sync failed", roundId, err);
    }
    try {
      await applyT0QuestionGapTagsForRound(db, round.projectId, roundId);
    } catch (err) {
      console.warn("[t0-execution] question gap tag apply failed", roundId, err);
    }
    void emitT0CompleteNotification(db, round.projectId, round.roundName).catch(err =>
      console.warn("[notifications] T0 failed", roundId, err),
    );
  }

  return {
    roundId,
    completedRuns: totalCompleted,
    failedRuns: state.failedRuns,
    failures: state.failures,
  };
}

/** 若轮次处于 running 且后台 worker 未在执行，则恢复/继续 T0 检测（幂等，可安全在轮询时调用） */
export function ensureT0ExecutionContinues(db: DbConn, roundId: string): void {
  if (activeT0Executions.has(roundId)) return;

  void (async () => {
    const roundRows = await db.select().from(testRounds).where(eq(testRounds.id, roundId)).limit(1);
    const round = roundRows[0];
    if (!round || round.roundType !== "T0_BASELINE" || round.status !== "running") return;

    activeT0Executions.add(roundId);
    try {
      await runT0ExecutionBackground(db, roundId);
    } catch (err) {
      console.error("[t0-execution] background failed", roundId, err);
    } finally {
      activeT0Executions.delete(roundId);
    }
  })();
}

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
      message: `企业资料未满足 AI 现状检测要求，请先补全：${readiness.missingLabels.join("、")}`,
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
      message: "当前项目已有进行中的 AI 现状检测，请等待完成后再创建",
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
  const roundName = input.roundName?.trim() || "AI 现状检测";

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

export const T0_RUN_TIMEOUT_MS = 30_000;

export type StartT0ExecutionSuccess = {
  roundId: string;
  completedRuns: number;
  failedRuns: number;
  failures: Array<{ questionId: number; platform: string; runIndex: number; error: string }>;
};

export type StartT0ExecutionImmediateResult =
  | { roundId: string; status: "running" }
  | { error: "ROUND_ALREADY_STARTED" };

export type StartT0ExecutionResult = StartT0ExecutionImmediateResult;

async function executeT0RunWithTimeout(
  db: DbConn,
  input: Parameters<typeof executeT0Run>[1],
): Promise<ExecuteT0RunResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      executeT0Run(db, input),
      new Promise<ExecuteT0RunResult>(resolve => {
        timer = setTimeout(
          () => resolve({ ok: false, error: "单次实测超时（30秒），已跳过" }),
          T0_RUN_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

function recordT0RunOutcome(
  result: ExecuteT0RunResult,
  task: T0RunTask,
  state: Pick<StartT0ExecutionSuccess, "completedRuns" | "failedRuns" | "failures">,
): void {
  if (result.ok) {
    state.completedRuns += 1;
    return;
  }
  state.failedRuns += 1;
  state.failures.push({
    questionId: task.questionId,
    platform: task.platform,
    runIndex: task.runIndex,
    error: result.error,
  });
}

async function prepareT0ExecutionStart(db: DbConn, roundId: string) {
  const roundRows = await db.select().from(testRounds).where(eq(testRounds.id, roundId)).limit(1);
  const round = roundRows[0];
  if (!round) {
    throw new TRPCError({ code: "NOT_FOUND", message: "检测轮次不存在" });
  }
  if (round.roundType !== "T0_BASELINE") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "仅 AI 现状检测轮次可执行此操作" });
  }

  const boundRows = await db
    .select({ questionId: roundQuestions.questionId })
    .from(roundQuestions)
    .where(eq(roundQuestions.roundId, roundId));
  const boundQuestionIds = boundRows.map(r => r.questionId);
  if (boundQuestionIds.length === 0) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "该轮次未绑定任何问题" });
  }

  return { round, boundQuestionIds };
}

export async function runT0ExecutionBackground(
  db: DbConn,
  roundId: string,
): Promise<StartT0ExecutionSuccess> {
  const { round, boundQuestionIds } = await prepareT0ExecutionStart(db, roundId);

  const platforms = round.platforms ?? [];
  const runsPerQuestion = round.runsPerQuestion ?? 3;
  const state = { completedRuns: 0, failedRuns: 0, failures: [] as StartT0ExecutionSuccess["failures"] };
  const completedTaskKeys = await loadCompletedT0TaskKeys(db, roundId);
  const existingCompletedCount = completedTaskKeys.size;

  const earlyFinish = await finalizeT0RoundIfComplete(db, round, roundId, state, existingCompletedCount);
  if (earlyFinish) {
    return earlyFinish;
  }

  try {
    for (const questionId of boundQuestionIds) {
      for (let runIndex = 1; runIndex <= runsPerQuestion; runIndex += 1) {
        const pendingPlatforms = platforms.filter(
          platform => !completedTaskKeys.has(buildT0RunTaskKey(questionId, platform, runIndex)),
        );
        if (pendingPlatforms.length === 0) continue;

        const platformResults = await Promise.allSettled(
          pendingPlatforms.map(platform =>
            executeT0RunWithTimeout(db, {
              projectId: round.projectId,
              roundId,
              questionId,
              platform,
              runIndex,
            }),
          ),
        );

        for (let i = 0; i < pendingPlatforms.length; i += 1) {
          const platform = pendingPlatforms[i]!;
          const task: T0RunTask = { questionId, platform, runIndex };
          const settled = platformResults[i]!;
          if (settled.status === "rejected") {
            const message =
              settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
            recordT0RunOutcome({ ok: false, error: message }, task, state);
          } else {
            recordT0RunOutcome(settled.value, task, state);
            if (settled.value.ok) {
              completedTaskKeys.add(buildT0RunTaskKey(questionId, platform, runIndex));
            }
          }
        }
      }
    }

    const finished = await finalizeT0RoundIfComplete(
      db,
      round,
      roundId,
      state,
      existingCompletedCount,
    );
    if (finished) {
      return finished;
    }

    const finishedAt = new Date();
    const totalCompleted = existingCompletedCount + state.completedRuns;
    const finalStatus = state.failedRuns > 0 && totalCompleted === 0 ? "failed" : "completed";
    await db
      .update(testRounds)
      .set({ status: finalStatus, finishedAt })
      .where(eq(testRounds.id, roundId));

    if (finalStatus === "completed") {
      try {
        await syncCompetitorAiMentionCounts(db, round.projectId);
      } catch (err) {
        console.warn("[t0-execution] competitor mention sync failed", roundId, err);
      }
      try {
        await applyT0QuestionGapTagsForRound(db, round.projectId, roundId);
      } catch (err) {
        console.warn("[t0-execution] question gap tag apply failed", roundId, err);
      }
      void emitT0CompleteNotification(db, round.projectId, round.roundName).catch(err =>
        console.warn("[notifications] T0 failed", roundId, err),
      );
    }

    return {
      roundId,
      completedRuns: totalCompleted,
      failedRuns: state.failedRuns,
      failures: state.failures,
    };
  } catch (err) {
    const finishedAt = new Date();
    await db
      .update(testRounds)
      .set({ status: "failed", finishedAt })
      .where(eq(testRounds.id, roundId));
    throw err;
  }
}

export async function startT0Execution(db: DbConn, roundId: string): Promise<StartT0ExecutionResult> {
  await prepareT0ExecutionStart(db, roundId);

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
    const roundRows = await db
      .select({ status: testRounds.status })
      .from(testRounds)
      .where(eq(testRounds.id, roundId))
      .limit(1);
    if (roundRows[0]?.status === "running") {
      ensureT0ExecutionContinues(db, roundId);
      return { roundId, status: "running" };
    }
    return { error: "ROUND_ALREADY_STARTED" };
  }

  ensureT0ExecutionContinues(db, roundId);
  return { roundId, status: "running" };
}
