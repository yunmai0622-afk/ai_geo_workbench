/**
 * GEO 发布链路数据流验收（无需启动 Local Agent）
 *
 * 流程：publishTasks.create（知乎）→ pollAgentTasks → 校验 action=publish → 打印详情
 * 不 claim、不 report，不会在平台侧真实发帖。
 *
 * 用法：
 *   DATABASE_URL=... pnpm exec tsx scripts/test-publish-flow.ts
 *
 * 可选环境变量：
 *   PUBLISH_TEST_PROJECT_ID
 *   PUBLISH_TEST_ARTICLE_ID
 *   PUBLISH_TEST_PLATFORM_ACCOUNT_ID
 *   PUBLISH_TEST_PROJECT_NAME（自动发现项目，默认「海豚知道」）
 *   PUBLISH_TEST_KEEP=1（保留 pending_agent 任务，默认验证后删除）
 */
import "dotenv/config";
import { and, desc, eq } from "drizzle-orm";
import { geoArticles, projectPlatformAccounts, projects, publishTasks } from "../drizzle/schema";
import { pollAgentTasks } from "../server/agentPublishTasks";
import { getDb } from "../server/db";
import { appRouter } from "../server/routers";
import { getContentQualityGateStatus } from "../shared/contentQualityGate";

const TEST_MARKER = "[publish-flow-e2e]";

const user = {
  id: 1,
  openId: "publish-flow-e2e",
  role: "admin" as const,
  name: "Publish Flow E2E",
  email: null,
  loginMethod: null,
  lastSignedIn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function truncate(text: string | null | undefined, max = 240): string {
  const value = (text ?? "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…(${value.length} chars)`;
}

function sanitizePollTask(task: Record<string, unknown>) {
  return {
    ...task,
    content: truncate(String(task.content ?? "")),
    coverBase64: task.coverBase64 ? `[base64 ${String(task.coverBase64).length} chars]` : undefined,
  };
}

async function resolveFixtures(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const projectIdEnv = Number(process.env.PUBLISH_TEST_PROJECT_ID);
  const articleIdEnv = Number(process.env.PUBLISH_TEST_ARTICLE_ID);
  const platformAccountIdEnv = Number(process.env.PUBLISH_TEST_PLATFORM_ACCOUNT_ID);

  let projectId = Number.isFinite(projectIdEnv) && projectIdEnv > 0 ? projectIdEnv : 0;
  if (!projectId) {
    const projectName = (process.env.PUBLISH_TEST_PROJECT_NAME ?? "海豚知道").trim();
    const [project] = await db
      .select({ id: projects.id, enterpriseName: projects.enterpriseName })
      .from(projects)
      .where(eq(projects.enterpriseName, projectName))
      .limit(1);
    assert(project, `未找到项目「${projectName}」，请设置 PUBLISH_TEST_PROJECT_ID`);
    projectId = project.id;
    console.log(`[resolve] projectId=${projectId} (${project.enterpriseName})`);
  }

  let platformAccountId =
    Number.isFinite(platformAccountIdEnv) && platformAccountIdEnv > 0 ? platformAccountIdEnv : 0;
  let localAgentId = "";
  if (!platformAccountId) {
    const accounts = await db
      .select()
      .from(projectPlatformAccounts)
      .where(
        and(
          eq(projectPlatformAccounts.projectId, projectId),
          eq(projectPlatformAccounts.platform, "zhihu"),
        ),
      );
    const account = accounts.find(
      row =>
        row.isEnabled !== 0 &&
        Boolean(row.localAgentId?.trim()) &&
        Boolean(row.localProfileId?.trim()) &&
        row.sessionStatus === "active",
    );
    assert(
      account,
      "未找到可用的知乎绑定账号（需 localAgentId、localProfileId、sessionStatus=active）",
    );
    platformAccountId = account.id;
    localAgentId = account.localAgentId!.trim();
    console.log(
      `[resolve] platformAccountId=${platformAccountId} account=${account.accountName} localAgentId=${localAgentId}`,
    );
  } else {
    const [account] = await db
      .select()
      .from(projectPlatformAccounts)
      .where(eq(projectPlatformAccounts.id, platformAccountId))
      .limit(1);
    assert(account && account.projectId === projectId, "platformAccountId 与 projectId 不匹配");
    assert(account.platform === "zhihu", "platformAccountId 须为知乎账号");
    localAgentId = account.localAgentId?.trim() ?? "";
    assert(localAgentId, "绑定账号缺少 localAgentId");
  }

  let articleId = Number.isFinite(articleIdEnv) && articleIdEnv > 0 ? articleIdEnv : 0;
  if (!articleId) {
    const articles = await db
      .select()
      .from(geoArticles)
      .where(eq(geoArticles.projectId, projectId))
      .orderBy(desc(geoArticles.id))
      .limit(30);
    const article =
      articles.find(row => getContentQualityGateStatus(row).passed) ?? articles[0] ?? null;
    assert(article, `项目 ${projectId} 下没有可用文章，请设置 PUBLISH_TEST_ARTICLE_ID`);
    articleId = article.id;
    const gate = getContentQualityGateStatus(article);
    console.log(
      `[resolve] articleId=${articleId} title=${truncate(article.title, 60)} quality=${gate.reason}`,
    );
  }

  return { projectId, articleId, platformAccountId, localAgentId };
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[publish-flow-e2e] 需要 DATABASE_URL");
    process.exit(1);
  }

  const db = await getDb();
  assert(db, "数据库不可用");

  const fixtures = await resolveFixtures(db);
  const caller = appRouter.createCaller({ user, req: {} as never, res: {} as never });

  console.log("\n[step 1] publishTasks.create (zhihu, local_agent, pending_agent)");
  const created = await caller.publishTasks.create({
    projectId: fixtures.projectId,
    articleId: fixtures.articleId,
    platform: "zhihu",
    platformAccountId: fixtures.platformAccountId,
  });
  const taskId = created.taskId;
  assert(taskId > 0, "创建发布任务失败：未返回 taskId");
  console.log("[create]", JSON.stringify(created, null, 2));

  const [taskRow] = await db.select().from(publishTasks).where(eq(publishTasks.id, taskId)).limit(1);
  assert(taskRow, `publish_tasks 中未找到任务 ${taskId}`);
  assert(taskRow.status === "pending_agent", `任务状态应为 pending_agent，实际为 ${taskRow.status}`);
  assert(taskRow.platform === "zhihu", `任务平台应为 zhihu，实际为 ${taskRow.platform}`);

  const localAgentId = (taskRow.localAgentId ?? fixtures.localAgentId).trim();
  assert(localAgentId, "任务缺少 localAgentId，pollAgentTasks 无法匹配");

  console.log("\n[step 2] pollAgentTasks");
  const polled = await pollAgentTasks(db, localAgentId, 10);
  const matched = polled.tasks.find(t => t.taskId === taskId);
  assert(matched, `poll 结果中未包含 taskId=${taskId}（共 ${polled.tasks.length} 条待处理）`);
  assert(matched.action === "publish", `action 应为 publish，实际为 ${String(matched.action)}`);

  console.log("\n[step 3] 任务详情");
  console.log(
    JSON.stringify(
      {
        phase: "GEO-V1.1-Publish-E2E-Test",
        marker: TEST_MARKER,
        create: created,
        dbRow: {
          id: taskRow.id,
          projectId: taskRow.projectId,
          articleId: taskRow.articleId,
          platform: taskRow.platform,
          status: taskRow.status,
          platformAccountId: taskRow.platformAccountId,
          expectedAccountName: taskRow.expectedAccountName,
          localAgentId: taskRow.localAgentId,
          localProfileId: taskRow.localProfileId,
          articleTitle: taskRow.articleTitle,
          articleContentPreview: truncate(taskRow.articleContent, 320),
          coverImageUrl: taskRow.coverImageUrl,
          createdAt: taskRow.createdAt,
        },
        pollTask: sanitizePollTask(matched as unknown as Record<string, unknown>),
        pollTaskCount: polled.tasks.length,
      },
      null,
      2,
    ),
  );

  const keep = process.env.PUBLISH_TEST_KEEP === "1";
  if (!keep) {
    await db.delete(publishTasks).where(eq(publishTasks.id, taskId));
    console.log(`\n[cleanup] 已删除测试任务 taskId=${taskId}（设 PUBLISH_TEST_KEEP=1 可保留）`);
  } else {
    console.log(`\n[cleanup] 保留任务 taskId=${taskId}（PUBLISH_TEST_KEEP=1）`);
  }

  console.log("\n[OK] 发布链路数据流验收通过：create → pending_agent → poll → action=publish");
}

main().catch(error => {
  console.error("\n[FAIL]", error instanceof Error ? error.message : error);
  process.exit(1);
});
