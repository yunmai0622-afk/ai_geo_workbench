export type HealthResponse = {
  ok: boolean;
  version: string;
  api: { ok: boolean };
  database: { ok: boolean; message?: string };
  llm: { ok: boolean; message?: string; provider?: string; model?: string };
};
