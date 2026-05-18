import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import { enterpriseGeoProfiles, projects } from "../drizzle/schema";
import { getDb } from "../server/db";
import { appRouter } from "../server/routers";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[P0-1] DATABASE_URL is required for enterprise profile DB acceptance.");
  process.exit(1);
}

const user = {
  id: 1,
  openId: "p0-enterprise-profile-db-acceptance",
  role: "admin" as const,
  name: "P0 Enterprise Profile DB Acceptance",
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
  const enterpriseName = `P0 企业档案 DB 验收 ${timestamp}`;

  const caller = createProtectedCaller();

  await caller.geo.projects.create({
    enterpriseName,
    industry: "P0 本地数据库验收",
    website: "https://p0-enterprise-profile-db.local",
    region: "本地",
    productIntro: "用于验证企业档案保存链路的核心产品服务说明。",
    targetCustomers: "需要验证本地数据库迁移可运行性的项目维护者。",
    coreSellingPoints: "通过真实数据库写入和读回验证企业档案链路。",
    competitorNames: [],
    coreKeywords: ["企业档案", "数据库验收", "P0"],
  });

  const createdProject = (
    await db
      .select()
      .from(projects)
      .where(eq(projects.enterpriseName, enterpriseName))
      .orderBy(desc(projects.createdAt))
      .limit(1)
  )[0];

  assert(createdProject, "Created project was not found in database.");

  const profileInput = {
    projectId: createdProject.id,
    enterpriseName,
    shortName: "P0 DB 验收",
    officialWebsite: "https://p0-enterprise-profile-db.local",
    industry: "P0 本地数据库验收",
    region: "本地",
    productServiceIntro: "企业档案保存、读取和一致性校验。",
    targetCustomers: "负责 Codex 本地迁移验证的维护者。",
    coreSellingPoints: "使用 protected tRPC caller 写入真实数据库，再从企业档案 summary 读回校验。",
    servicePriceRange: "不适用",
    serviceModel: "本地验收脚本",
    fitCustomers: "需要确认企业档案 DB 链路可用的项目维护者。",
    unfitCustomers: "不用于业务演示或客户交付。",
    salesChannels: ["本地脚本"],
    commonQuestions: ["企业档案能否保存到真实数据库？"],
    purchaseDecisionFactors: ["真实写入", "真实读回", "字段一致"],
    productIntro: "P0-1 企业档案 DB 验收脚本。",
    featureNotes: "品牌说明/特征备注：仅用于本地迁移验收，不代表业务样例数据。",
    serviceProcess: "创建项目、保存企业档案、读取 summary、逐字段断言。",
    deliveryPlan: "单次脚本执行完成。",
    afterSalesService: "不适用。",
    competitorDifference: "核心优势/差异化：不绕过 protectedProcedure，不使用 mock 数据。",
    priceExplanation: "不适用。",
    salesTalkTracks: "不适用。",
    commonObjections: "不适用。",
  };

  const upsertResult = await caller.geo.assetLibrary.upsertProfile(profileInput);
  assert(upsertResult.success, "upsertProfile did not report success.");

  const summary = await caller.geo.assetLibrary.summary({ projectId: createdProject.id });
  const profile = summary.profile;
  assert(profile, "Enterprise profile was not returned from summary.");

  const expectedFields = {
    projectId: createdProject.id,
    enterpriseName: profileInput.enterpriseName,
    industry: profileInput.industry,
    targetCustomers: profileInput.targetCustomers,
    productServiceIntro: profileInput.productServiceIntro,
    coreSellingPoints: profileInput.coreSellingPoints,
    competitorDifference: profileInput.competitorDifference,
    featureNotes: profileInput.featureNotes,
  };

  const readBackFields = {
    projectId: profile.projectId,
    enterpriseName: profile.enterpriseName,
    industry: profile.industry,
    targetCustomers: profile.targetCustomers,
    productServiceIntro: profile.productServiceIntro,
    coreSellingPoints: profile.coreSellingPoints,
    competitorDifference: profile.competitorDifference,
    featureNotes: profile.featureNotes,
  };

  for (const [key, expected] of Object.entries(expectedFields)) {
    const actual = readBackFields[key as keyof typeof readBackFields];
    assert(actual !== null && actual !== undefined && String(actual).length > 0, `${key} was empty after readback.`);
    assert(actual === expected, `${key} mismatch. expected=${String(expected)} actual=${String(actual)}`);
  }

  const dbProfile = (
    await db
      .select()
      .from(enterpriseGeoProfiles)
      .where(eq(enterpriseGeoProfiles.projectId, createdProject.id))
      .limit(1)
  )[0];
  assert(dbProfile, "Enterprise profile row was not found in database.");

  console.log(JSON.stringify({
    success: true,
    projectId: createdProject.id,
    profileId: dbProfile.id,
    writtenFields: expectedFields,
    readBackFields,
    allFieldsMatched: true,
  }, null, 2));
}

main().catch(error => {
  console.error("[P0-1] Enterprise profile DB acceptance failed:");
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  try {
    await closeDatabase();
  } catch (error) {
    console.error("[P0-1] Failed to close database connection:");
    console.error(error);
    process.exitCode = process.exitCode || 1;
  }
});
