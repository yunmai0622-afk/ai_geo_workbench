import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { diagnoseLlmProviderEnv } from "../shared/llmEnvDiagnostics";
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
