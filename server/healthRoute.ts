import type { Express, Request, Response } from "express";
import type { HealthResponse } from "../shared/health";
import {
  checkDatabaseConnection,
  checkLlmService,
  getAppVersion,
} from "./healthChecks";

export async function buildHealthResponse(): Promise<HealthResponse> {
  const [database, llm] = await Promise.all([checkDatabaseConnection(), checkLlmService()]);
  const api = { ok: true };
  return {
    ok: api.ok && database.ok && llm.ok,
    version: getAppVersion(),
    api,
    database,
    llm,
  };
}

export function registerHealthRoute(app: Express) {
  app.get("/api/health", async (_req: Request, res: Response) => {
    try {
      const payload = await buildHealthResponse();
      res.status(payload.ok ? 200 : 503).json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "健康检查失败";
      res.status(500).json({
        ok: false,
        version: getAppVersion(),
        api: { ok: false },
        database: { ok: false, message },
        llm: { ok: false, message },
      } satisfies HealthResponse);
    }
  });
}
