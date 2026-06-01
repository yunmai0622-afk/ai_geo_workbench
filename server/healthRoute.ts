import type { Express, Request, Response } from "express";
import type { HealthResponse } from "../shared/health";
import {
  checkDatabaseConnection,
  checkLlmService,
  checkOperationsHealth,
  getAppVersion,
} from "./healthChecks";

export async function buildHealthResponse(): Promise<HealthResponse> {
  const [database, llm, operations] = await Promise.all([
    checkDatabaseConnection(),
    checkLlmService(),
    checkOperationsHealth(),
  ]);
  const api = { ok: true };
  return {
    ok: api.ok && database.ok && llm.ok,
    version: getAppVersion(),
    api,
    database,
    llm,
    operations,
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
        operations: {
          lastContentGeneration: { ok: false, message },
          lastPublish: { ok: false, message },
          queueTaskCount: 0,
          queueAvailable: false,
        },
      } satisfies HealthResponse);
    }
  });
}
