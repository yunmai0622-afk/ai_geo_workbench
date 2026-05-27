#!/usr/bin/env node
/**
 * GEO LLM 运行时环境审计（不输出密钥明文）
 * 用法：node scripts/geo_llm_env_runtime_audit.mjs
 * 可选：GEO_PROBE_LLM=1 发起最小 chat/completions 探测
 */
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: resolve(root, ".env") });

function maskSecret(value) {
  const t = (value ?? "").trim();
  if (!t) return false;
  return true;
}

function resolveOpenAIApiUrl() {
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/+$/, "");
  const path = process.env.OPENAI_CHAT_COMPLETIONS_PATH ?? "/chat/completions";
  const p = path.startsWith("/") ? path : `/${path}`;
  if (base.endsWith("/chat/completions")) return base;
  if (base.endsWith("/v1") || base.endsWith("/api/v3")) return `${base}${p}`;
  return `${base}/v1${p}`;
}

async function probeOpenAI() {
  const provider = (process.env.LLM_PROVIDER ?? "openai").trim() || "openai";
  if (provider === "manus") {
    return {
      skipped: true,
      reason: "LLM_PROVIDER=manus，请使用 BUILT_IN_FORGE_API_KEY 在 Manus 环境探测",
    };
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { ok: false, status: null, errorSummary: "OPENAI_API_KEY missing" };
  }
  const url = resolveOpenAIApiUrl();
  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? 15000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    const text = await res.text();
    let errorSummary = text.slice(0, 300);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) errorSummary = `auth_failed status=${res.status}`;
      else if (res.status === 429) errorSummary = `rate_limit status=${res.status}`;
      else if (res.status === 404) errorSummary = `model_or_path_not_found status=${res.status}`;
      else errorSummary = `provider_error status=${res.status}`;
    } else {
      errorSummary = "ok";
    }
    return { ok: res.ok, status: res.status, errorSummary, endpoint: url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = e instanceof Error && "code" in e ? String(e.code) : "";
    if (/abort|timeout/i.test(msg)) {
      return { ok: false, status: null, errorSummary: `timeout: ${msg}`, endpoint: url };
    }
    return { ok: false, status: null, errorSummary: `network: ${code || msg}`, endpoint: url };
  } finally {
    clearTimeout(timer);
  }
}

const report = {
  phase: "GEO-Real-Data-Chain-Final-Debug-P0",
  at: new Date().toISOString(),
  LLM_PROVIDER: (process.env.LLM_PROVIDER ?? "openai").trim() || "openai",
  OPENAI_API_KEY_exists: maskSecret(process.env.OPENAI_API_KEY),
  BUILT_IN_FORGE_API_KEY_exists: maskSecret(process.env.BUILT_IN_FORGE_API_KEY),
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL?.trim() || "(default https://api.openai.com)",
  OPENAI_MODEL: process.env.OPENAI_MODEL?.trim() || "(default gpt-4.1-mini)",
  OPENAI_TIMEOUT_MS: process.env.OPENAI_TIMEOUT_MS?.trim() || "(default 60000)",
  analysisRunEnv: "geo.analysis.run → invokeLLM → diagnoseLlmProviderEnv (OPENAI_API_KEY / BUILT_IN_FORGE_API_KEY)",
  articlesGenerateEnv: "geo.articles.generate → diagnoseLlmProviderEnv + classifyPlatformContentLlmError (same env)",
  probe: null,
};

if (process.env.GEO_PROBE_LLM === "1") {
  report.probe = await probeOpenAI();
} else {
  report.probe = { skipped: true, hint: "设置 GEO_PROBE_LLM=1 发起最小模型请求" };
}

console.log(JSON.stringify(report, null, 2));
