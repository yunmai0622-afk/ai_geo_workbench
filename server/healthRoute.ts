import type { Express, Request, Response } from "express";
import type { HealthResponse } from "../shared/health";
import {
  checkDatabaseConnection,
  checkLlmService,
  checkOperationsHealth,
  getAppVersion,
} from "./healthChecks";
import { buildRuntimeVersionInfo } from "./versionInfo";
import { isAiObservationLedgerV2Enabled } from "./aiObservationLedgerService";

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
  app.get("/health", (_req: Request, res: Response) => {
    const versionInfo = buildRuntimeVersionInfo();
    res.set("Cache-Control", "no-store");
    res.status(200).json({
      ok: true,
      version: versionInfo.version,
      commit: versionInfo.commit,
      buildTime: versionInfo.buildTime,
      environment: versionInfo.environment,
      features: { aiObservationLedgerV2: isAiObservationLedgerV2Enabled() },
    });
  });

  for (const path of ["/version.json", "/manus/version.json", "/__manus__/version.json"]) {
    app.get(path, (_req: Request, res: Response) => {
      res.set("Cache-Control", "no-store");
      res.status(200).json(buildRuntimeVersionInfo());
    });
  }

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
