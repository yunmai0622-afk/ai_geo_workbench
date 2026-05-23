import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { GeoQualityReviewResult } from "@shared/geoQualityReview";
import { parseAndNormalizeGeoQualityReview } from "@shared/geoQualityReview";
import { geoArticles, geoArticleTopics, projects } from "../drizzle/schema";
import type { getDb } from "./db";
import { buildQualityReviewPrompt } from "./geoQualityPrompt";
import { defaultModelRouter } from "./modelRouter";

type Db = Awaited<ReturnType<typeof getDb>>;

export async function runContentQualityReview(
  db: NonNullable<Db>,
  input: { articleId: number; projectId: number },
): Promise<{
  result: GeoQualityReviewResult;
  modelName: string;
  reviewedAt: Date;
}> {
  const articleRows = await db
    .select()
    .from(geoArticles)
    .where(eq(geoArticles.id, input.articleId))
    .limit(1);
  const article = articleRows[0];
  if (!article || article.projectId !== input.projectId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "内容资产不存在" });
  }

  const body = (article.markdownContent ?? "").trim();
  if (!body) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "当前内容正文为空，无法进行质检" });
  }

  const projectRows = await db
    .select()
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  const project = projectRows[0];
  const brandName = (project?.enterpriseName ?? "").trim() || "当前企业";

  let targetQuestion = article.title;
  let contentType = article.articleType;
  if (article.topicId) {
    const topicRows = await db
      .select()
      .from(geoArticleTopics)
      .where(eq(geoArticleTopics.id, article.topicId))
      .limit(1);
    const topic = topicRows[0];
    if (topic) {
      targetQuestion = topic.title || targetQuestion;
      contentType = topic.articleType || contentType;
      if (!targetQuestion && topic.businessReason) {
        const m = topic.businessReason.match(/目标问题[：:]\s*([^；\n]+)/);
        if (m?.[1]) targetQuestion = m[1].trim();
      }
    }
  }

  const { systemPrompt, userPrompt } = buildQualityReviewPrompt({
    title: article.title,
    body,
    brandName,
    targetQuestion: targetQuestion || "（未指定目标问题）",
    contentType: contentType || "其他",
  });

  let modelText: string;
  let modelName: string;
  try {
    const resp = await defaultModelRouter.callModel("quality_review", userPrompt, { systemPrompt });
    modelText = resp.text;
    modelName = resp.modelName;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("暂未接入")) {
      throw new TRPCError({ code: "BAD_REQUEST", message: msg });
    }
    console.error("[GEO质检] 模型调用失败", e);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "质检服务暂时不可用，请稍后重试" });
  }

  let result: GeoQualityReviewResult;
  try {
    result = parseAndNormalizeGeoQualityReview(modelText);
  } catch (e) {
    console.error("[GEO质检] JSON 解析失败", modelText.slice(0, 500));
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: e instanceof Error ? e.message : "质检结果格式异常，请重试",
    });
  }

  const reviewedAt = new Date();
  await db
    .update(geoArticles)
    .set({
      geoQualityScore: result.total,
      geoQualityDetail: result,
      geoQualityReviewedAt: reviewedAt,
      geoQualityModel: modelName,
      geoQualityRecommendation: result.recommendation,
      geoQualityStale: 0,
    })
    .where(eq(geoArticles.id, input.articleId));

  return { result, modelName, reviewedAt };
}
