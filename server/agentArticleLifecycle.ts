import { desc, eq } from "drizzle-orm";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import {
  geoArticleQualityScores,
  geoArticles,
  geoInclusionMonitoringRecords,
  geoPublishRecords,
  optimizationTasks,
  publishTasks,
} from "../drizzle/schema";
import type { AgentPublishStatus } from "./agentPublishTasks";
import { syncLifecycleFromAgentPublishTask } from "./articleLifecycleService";
import { buildInitialInclusionMonitoringRecord } from "./geoMonitoring";
import type { requireDbConn } from "./projectPlatformAccounts";

type DbConn = Awaited<ReturnType<typeof requireDbConn>>;
type PublishTaskRow = typeof publishTasks.$inferSelect;

const AGENT_PLATFORM_CHANNEL: Record<string, "知乎" | "头条号" | "搜狐号" | "百家号"> = {
  zhihu: "知乎",
  toutiao: "头条号",
  sohu: "搜狐号",
  baijiahao: "百家号",
};

/**
 * Local Agent 回传终态后：写入 lifecycleEvents + 发布记录（不伪造 published）。
 */
export async function syncArticleLifecycleFromAgentTask(
  db: DbConn,
  task: PublishTaskRow,
  input: {
    status: AgentPublishStatus;
    draftUrl?: string | null;
    publishedUrl?: string | null;
    errorMessage?: string | null;
  },
): Promise<{
  articleStatus?: string;
  publishRecordCreated: boolean;
  inclusionMonitoringCreated: boolean;
  lifecycleStatus?: string | null;
}> {
  const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, task.articleId)).limit(1);
  const article = articleRows[0];
  if (!article) {
    return { publishRecordCreated: false, inclusionMonitoringCreated: false };
  }

  const channel = AGENT_PLATFORM_CHANNEL[task.platform];
  const lifecycle = await syncLifecycleFromAgentPublishTask(db, {
    articleId: task.articleId,
    taskId: task.id,
    platform: task.platform,
    agentStatus: input.status,
    publicUrl: input.publishedUrl,
    draftUrl: input.draftUrl,
    errorMessage: input.errorMessage,
  });

  if (!channel) {
    return {
      publishRecordCreated: false,
      inclusionMonitoringCreated: false,
      lifecycleStatus: lifecycle.lifecycleStatus,
    };
  }

  const scoreRows = await db
    .select()
    .from(geoArticleQualityScores)
    .where(eq(geoArticleQualityScores.articleId, article.id))
    .orderBy(desc(geoArticleQualityScores.createdAt))
    .limit(1);
  const qualityScore = scoreRows[0]?.totalScore ?? GEO_ARTICLE_MIN_PASS_SCORE;

  let publishRecordCreated = false;
  let inclusionMonitoringCreated = false;

  if (input.status === "completed" && input.publishedUrl?.trim()) {
    const publicUrl = input.publishedUrl.trim();
    const inserted = await db
      .insert(geoPublishRecords)
      .values({
        projectId: task.projectId,
        articleId: article.id,
        optimizationTaskId: article.optimizationTaskId,
        publishChannel: channel,
        publishTitle: task.articleTitle,
        publishUrl: publicUrl,
        publishStatus: "已发布",
        qualityScore,
        needRetest: 1,
        notes: "本地 Agent 发布完成（含 publicUrl 证据）",
      })
      .$returningId();
    let publishRecordId = inserted[0]?.id;
    if (!publishRecordId) {
      const latestRows = await db
        .select({ id: geoPublishRecords.id })
        .from(geoPublishRecords)
        .where(eq(geoPublishRecords.articleId, article.id))
        .orderBy(desc(geoPublishRecords.createdAt))
        .limit(1);
      publishRecordId = latestRows[0]?.id;
    }
    if (article.optimizationTaskId) {
      await db
        .update(optimizationTasks)
        .set({ status: "retest", publishedUrl: publicUrl, needRetest: 1 })
        .where(eq(optimizationTasks.id, article.optimizationTaskId));
    }
    publishRecordCreated = true;

    if (publishRecordId) {
      const existingMonitoring = await db
        .select({ id: geoInclusionMonitoringRecords.id })
        .from(geoInclusionMonitoringRecords)
        .where(eq(geoInclusionMonitoringRecords.publishRecordId, publishRecordId))
        .limit(1);
      if (!existingMonitoring[0]) {
        await db.insert(geoInclusionMonitoringRecords).values(
          buildInitialInclusionMonitoringRecord({
            projectId: task.projectId,
            articleId: article.id,
            publishRecordId,
            publicUrl,
            qualityScore,
            rawJsonSource: "agent_publish_completed",
            rawJsonCreatedBy: "agent.reportAgentTaskResult",
          }),
        );
        inclusionMonitoringCreated = true;
      }
    }
  }

  if (input.status === "draft_saved" && input.draftUrl?.trim()) {
    await db.insert(geoPublishRecords).values({
      projectId: task.projectId,
      articleId: article.id,
      optimizationTaskId: article.optimizationTaskId,
      publishChannel: channel,
      publishTitle: task.articleTitle,
      publishUrl: input.draftUrl.trim(),
      publishStatus: "草稿已保存",
      qualityScore,
      needRetest: 0,
      notes: "本地 Agent 已保存平台草稿（有 draftUrl 证据）",
    });
    publishRecordCreated = true;
  }

  if (input.status === "manual_required") {
    await db.insert(geoPublishRecords).values({
      projectId: task.projectId,
      articleId: article.id,
      optimizationTaskId: article.optimizationTaskId,
      publishChannel: channel,
      publishTitle: task.articleTitle,
      publishUrl: input.draftUrl?.trim() || "https://www.zhihu.com/write",
      publishStatus: "待人工确认",
      qualityScore,
      needRetest: 0,
      notes: input.errorMessage?.trim() || "本地 Agent 已填稿，需在平台窗口人工确认保存",
    });
    publishRecordCreated = true;
  }

  return {
    articleStatus: article.status,
    publishRecordCreated,
    inclusionMonitoringCreated,
    lifecycleStatus: lifecycle.lifecycleStatus,
  };
}
