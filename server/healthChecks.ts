import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { desc, inArray, sql } from "drizzle-orm";
import type { HealthOperationsSnapshot } from "../shared/health";
import {
  evaluateLastContentGeneration,
  evaluateLastPublish,
  PUBLISH_QUEUE_ACTIVE_STATUSES,
} from "../shared/healthOperations";
import { diagnoseLlmProviderEnv } from "../shared/llmEnvDiagnostics";
import { geoArticles, publishTasks } from "../drizzle/schema";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";

const APP_ROOT = resolve(import.meta.dirname, "..");

export function getAppVersion(): string {
  const pkg = JSON.parse(readFileSync(resolve(APP_ROOT, "package.json"), "utf8")) as {
    version?: string;
  };
  return pkg.version?.trim() || "unknown";
}

export type ServiceCheckResult = {
  ok: boolean;
  message?: string;
};

export async function checkDatabaseConnection(): Promise<ServiceCheckResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, message: "DATABASE_URL 未配置" };
  }
  const db = await getDb();
  if (!db) {
    return { ok: false, message: "数据库连接不可用" };
  }
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "数据库查询失败";
    return { ok: false, message };
  }
}

function unavailableOperations(message: string): HealthOperationsSnapshot {
  return {
    lastContentGeneration: { ok: false, message },
    lastPublish: { ok: false, message },
    queueTaskCount: 0,
    queueAvailable: false,
  };
}

export async function checkOperationsHealth(): Promise<HealthOperationsSnapshot> {
  if (!process.env.DATABASE_URL?.trim()) {
    return unavailableOperations("DATABASE_URL 未配置");
  }
  const db = await getDb();
  if (!db) {
    return unavailableOperations("数据库连接不可用");
  }

  try {
    const [articleRows, publishRows, queueRows] = await Promise.all([
      db
        .select({
          markdownContent: geoArticles.markdownContent,
          createdAt: geoArticles.createdAt,
        })
        .from(geoArticles)
        .orderBy(desc(geoArticles.createdAt))
        .limit(1),
      db
        .select({
          status: publishTasks.status,
          updatedAt: publishTasks.updatedAt,
          agentFinishedAt: publishTasks.agentFinishedAt,
          errorMessage: publishTasks.errorMessage,
        })
        .from(publishTasks)
        .orderBy(desc(publishTasks.updatedAt))
        .limit(1),
      db
        .select({ count: sql<number>`count(*)` })
        .from(publishTasks)
        .where(inArray(publishTasks.status, [...PUBLISH_QUEUE_ACTIVE_STATUSES])),
    ]);

    const article = articleRows[0];
    const publish = publishRows[0];
    const queueTaskCount = Number(queueRows[0]?.count ?? 0);

    return {
      lastContentGeneration: evaluateLastContentGeneration(
        article
          ? {
              markdownContent: article.markdownContent,
              createdAt: article.createdAt,
            }
          : null,
      ),
      lastPublish: evaluateLastPublish(publish ?? null),
      queueTaskCount: Number.isFinite(queueTaskCount) ? queueTaskCount : 0,
      queueAvailable: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "运营状态查询失败";
    return unavailableOperations(message);
  }
}

export async function checkLlmService(): Promise<
  ServiceCheckResult & { provider?: string; model?: string }
> {
  const env = diagnoseLlmProviderEnv();
  if (!env.configured) {
    return {
      ok: false,
      provider: env.provider,
      model: env.model,
      message: `缺少环境变量：${env.missingEnvVars.join("、")}`,
    };
  }

  try {
    const result = await invokeLLM({
      messages: [{ role: "user", content: "Reply with exactly: ok" }],
      max_tokens: 8,
      timeoutMs: 20_000,
    });
    const text = result.choices?.[0]?.message?.content;
    const hasContent =
      typeof text === "string"
        ? text.trim().length > 0
        : Array.isArray(text) && text.length > 0;
    if (!hasContent) {
      return {
        ok: false,
        provider: env.provider,
        model: env.model,
        message: "LLM 返回为空",
      };
    }
    return { ok: true, provider: env.provider, model: env.model };
  } catch (error) {
    const message = error instanceof Error ? error.message : "LLM 调用失败";
    return { ok: false, provider: env.provider, model: env.model, message };
  }
}
