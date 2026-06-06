/** 生产 Web 域名（浏览器 HTTPS → 本机 HTTP 需 CORS + Private Network Access） */
export const LOCAL_AGENT_PRODUCTION_ORIGIN = "https://aigeoworkb-kzxhj9uy.manus.space";

export const LOCAL_AGENT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
] as const;

export const LOCAL_AGENT_ALLOWED_ORIGINS = new Set<string>([
  LOCAL_AGENT_PRODUCTION_ORIGIN,
  ...LOCAL_AGENT_DEV_ORIGINS,
]);

export function resolveLocalAgentCorsOrigin(origin: string | undefined): string | null {
  if (!origin?.trim()) return null;
  return LOCAL_AGENT_ALLOWED_ORIGINS.has(origin) ? origin : null;
}

export function buildLocalAgentCorsHeaders(origin: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Private-Network": "true",
  };
  const allowed = resolveLocalAgentCorsOrigin(origin);
  if (allowed) {
    headers["Access-Control-Allow-Origin"] = allowed;
  }
  return headers;
}
