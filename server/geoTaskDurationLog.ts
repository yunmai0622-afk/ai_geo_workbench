import { diagnoseLlmProviderEnv } from "@shared/llmEnvDiagnostics";

export type GeoAnalysisDurationLog = {
  action: "geo.analysis.run";
  projectId: number;
  provider: string;
  model: string;
  startedAt: string;
  durationMs: number;
  success: boolean;
  errorCode: string | null;
};

export type GeoArticlesGenerateDurationLog = {
  action: "geo.articles.generate";
  projectId: number;
  platform: string | null;
  provider: string;
  model: string;
  startedAt: string;
  durationMs: number;
  success: boolean;
  errorCode: string | null;
};

export function buildGeoTaskDurationLogBase(startedAtMs: number) {
  const env = diagnoseLlmProviderEnv();
  return {
    provider: env.provider,
    model: env.model,
    startedAt: new Date(startedAtMs).toISOString(),
    durationMs: Date.now() - startedAtMs,
  };
}

export function logGeoAnalysisRunDuration(payload: Omit<GeoAnalysisDurationLog, "action">) {
  const line: GeoAnalysisDurationLog = { action: "geo.analysis.run", ...payload };
  if (payload.success) {
    console.info("[geo.analysis.run]", JSON.stringify(line));
  } else {
    console.error("[geo.analysis.run]", JSON.stringify(line));
  }
}

export function logGeoArticlesGenerateDuration(payload: Omit<GeoArticlesGenerateDurationLog, "action">) {
  const line: GeoArticlesGenerateDurationLog = { action: "geo.articles.generate", ...payload };
  if (payload.success) {
    console.info("[geo.articles.generate]", JSON.stringify(line));
  } else {
    console.error("[geo.articles.generate]", JSON.stringify(line));
  }
}
