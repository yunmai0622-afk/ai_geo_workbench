import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import { aiResponses, projects } from "../drizzle/schema";
import { getDb } from "../server/db";
import { appRouter } from "../server/routers";

const databaseUrl = process.env.DATABASE_URL;
const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;
const provider = process.env.LLM_PROVIDER ?? "openai";
const openAiApiKey = process.env.OPENAI_API_KEY;

if (!databaseUrl) {
  console.error("[P0-2] DATABASE_URL is required for AI diagnosis acceptance.");
  process.exit(1);
}

if (provider === "openai" && !openAiApiKey) {
  console.error("[P0-2] P0-2 needs a real OpenAI LLM environment. OPENAI_API_KEY is required when LLM_PROVIDER=openai.");
  console.error("[P0-2] Current run did not execute real AI diagnosis.");
  process.exit(2);
}

if (provider !== "openai" && (!forgeApiUrl || !forgeApiKey)) {
  console.error("[P0-2] P0-2 needs a real Manus Forge LLM environment. BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY are required when LLM_PROVIDER is not openai.");
  console.error("[P0-2] Current run did not execute real AI diagnosis.");
  process.exit(2);
}

const user = {
  id: 1,
  openId: "p0-ai-diagnosis-min-acceptance",
  role: "admin" as const,
  name: "P0 AI Diagnosis Min Acceptance",
  email: null,
  loginMethod: null,
  lastSignedIn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

type AcceptanceDb = Awaited<ReturnType<typeof getDb>>;

let acceptanceDb: AcceptanceDb = null;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createProtectedCaller() {
  return appRouter.createCaller({ user, req: {} as never, res: {} as never });
}

function textFromRawJson(rawJson: Record<string, unknown>, key: string) {
  const direct = rawJson[key];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const diagnosis = rawJson.questionDiagnosis;
  if (diagnosis && typeof diagnosis === "object") {
    const value = (diagnosis as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function closeDatabase() {
  const client = (acceptanceDb as { $client?: { end?: () => Promise<unknown> | unknown } } | null)?.$client;
  if (client && typeof client.end === "function") {
    await client.end();
  }
}

async function main() {
  const db = await getDb();
  acceptanceDb = db;
  assert(db, "Database connection is not available.");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const enterpriseName = `P0 AI 诊断最小验收 ${timestamp}`;

  const caller = createProtectedCaller();

  await caller.geo.projects.create({
    enterpriseName,
    industry: "企业 AI 自动化与 GEO 优化",
    website: "https://p0-ai-diagnosis.local",
    region: "中国",
    productIntro: "面向中小企业的 AI 自动化系统、客户运营和 GEO 优化服务。",
    targetCustomers: "需要从业务场景切入建设 AI 自动化和 AI 搜索可见度的中小企业。",
    coreSellingPoints: "业务场景理解、自动化流程设计、GEO 内容结构化、可落地系统交付。",
    competitorNames: ["通用自动化工具", "传统 SEO 服务商"],
    coreKeywords: ["企业 AI 自动化", "GEO 优化", "AI 搜索可见度"],
  });

  const project = (
    await db
      .select()
      .from(projects)
      .where(eq(projects.enterpriseName, enterpriseName))
      .orderBy(desc(projects.createdAt))
      .limit(1)
  )[0];

  assert(project, "Created project was not found in database.");

  const responseInputs = [
    {
      projectId: project.id,
      questionId: null,
      questionText: "做企业 AI 自动化系统，哪家公司适合服务中小企业？",
      aiPlatform: "ChatGPT" as const,
      rawAnswer: "中小企业可以选择具备业务场景理解、自动化流程设计和系统交付能力的服务商。海豚知道在知识付费 SaaS、客户运营和 AI 自动化方面有积累，适合需要从业务场景切入的企业。",
      checkedAt: new Date().toISOString(),
    },
    {
      projectId: project.id,
      questionId: null,
      questionText: "企业做 GEO 优化应该从哪里开始？",
      aiPlatform: "Kimi" as const,
      rawAnswer: "企业应先梳理品牌实体、核心产品、客户案例、竞品差异和高频用户问题，再围绕 AI 搜索可能引用的内容进行结构化建设。",
      checkedAt: new Date().toISOString(),
    },
  ];

  const importResult = await caller.geo.aiResponses.importCsvRows({ rows: responseInputs });
  assert(importResult.success, "AI responses import did not report success.");

  const writtenResponses = await db
    .select()
    .from(aiResponses)
    .where(eq(aiResponses.projectId, project.id));
  assert(writtenResponses.length >= responseInputs.length, "AI responses were not written to database.");

  const analysisRunResult = await caller.geo.analysis.run({ projectId: project.id });
  assert(analysisRunResult.success, "analysis.run did not report success.");
  assert(analysisRunResult.count >= responseInputs.length, "analysis.run returned fewer rows than written AI responses.");

  const analyses = await caller.geo.analysis.list({ projectId: project.id });
  assert(analyses.length >= responseInputs.length, "analysis.list returned fewer rows than written AI responses.");

  for (const analysis of analyses) {
    assert(analysis.aiResponseId > 0, `analysis ${analysis.id} is missing aiResponseId.`);
    assert(typeof analysis.questionText === "string" && analysis.questionText.trim().length > 0, `analysis ${analysis.id} is missing questionText.`);
    assert(typeof analysis.optimizationSuggestion === "string" && analysis.optimizationSuggestion.trim().length > 0, `analysis ${analysis.id} is missing optimizationSuggestion.`);

    const rawJson = (analysis.rawJson ?? {}) as Record<string, unknown>;
    const problemType = textFromRawJson(rawJson, "problemType") || textFromRawJson(rawJson, "issueType") || textFromRawJson(rawJson, "questionType");
    const userIntent = textFromRawJson(rawJson, "userIntent");
    assert(problemType.length > 0, `analysis ${analysis.id} is missing problemType/issueType/questionType.`);
    assert(userIntent.length > 0, `analysis ${analysis.id} is missing userIntent.`);
  }

  const projectAfterAnalysis = (
    await db.select().from(projects).where(eq(projects.id, project.id)).limit(1)
  )[0];
  assert(projectAfterAnalysis?.status === "analysis_done", `project status should be analysis_done, actual=${projectAfterAnalysis?.status}`);

  const scoreResult = await caller.geo.scores.calculate({ projectId: project.id });
  assert(scoreResult.success, "scores.calculate did not report success.");
  assert(typeof scoreResult.score.totalScore === "number", "scores.calculate did not return totalScore.");

  const latestScore = await caller.geo.scores.latest({ projectId: project.id });
  assert(latestScore, "scores.latest returned no score.");
  assert(typeof latestScore.totalScore === "number", "latest score is missing totalScore.");
  assert(typeof latestScore.aiVisibilityScore === "number", "latest score is missing aiVisibilityScore.");
  assert(typeof latestScore.aiRecommendationScore === "number", "latest score is missing aiRecommendationScore.");

  const taskResult = await caller.geo.tasks.generate({ projectId: project.id });
  assert(taskResult.success, "tasks.generate did not report success.");
  const tasks = await caller.geo.tasks.list({ projectId: project.id });
  assert(tasks.length > 0, "tasks.list returned no tasks after tasks.generate.");

  console.log(JSON.stringify({
    success: true,
    projectId: project.id,
    aiResponseCount: writtenResponses.length,
    analysisCount: analyses.length,
    score: {
      totalScore: latestScore.totalScore,
      aiVisibilityScore: latestScore.aiVisibilityScore,
      aiRecommendationScore: latestScore.aiRecommendationScore,
      visibilityLevel: latestScore.visibilityLevel,
    },
    taskCount: tasks.length,
  }, null, 2));
}

main().catch(error => {
  console.error("[P0-2] AI diagnosis min acceptance failed:");
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  try {
    await closeDatabase();
  } catch (error) {
    console.error("[P0-2] Failed to close database connection:");
    console.error(error);
    process.exitCode = process.exitCode || 1;
  }
});
