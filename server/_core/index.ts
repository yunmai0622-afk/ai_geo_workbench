import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerHealthRoute } from "../healthRoute";
import { registerApiDocsRoute } from "../apiDocsRoute";
import { registerLocalAgentAccountStatusRoute } from "../localAgentAccountStatusRoute";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startDailyAiCheckScheduler } from "../scheduledAiCheck";
import { startWeeklyGrowthReportScheduler } from "../scheduledWeeklyGrowthReport";
import { ensureGeoQualityColumns } from "../ensureGeoQualityColumns";
import { ensureProjectsOwnerUserIdColumn } from "../ensureProjectsOwnerUserId";
import { diagnoseLlmProviderEnv, formatMissingLlmEnvServerLog } from "../../shared/llmEnvDiagnostics";
import { loadGeoSystemConfig } from "../geoSystemConfigStore";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  await Promise.all([ensureGeoQualityColumns(), ensureProjectsOwnerUserIdColumn(), loadGeoSystemConfig()]);
  const llmEnv = diagnoseLlmProviderEnv();
  if (!llmEnv.configured) {
    console.warn(
      `[startup] ${formatMissingLlmEnvServerLog(llmEnv.missingEnvVars)} (provider=${llmEnv.provider}, model=${llmEnv.model})`,
    );
  }
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerHealthRoute(app);
  registerApiDocsRoute(app);
  registerLocalAgentAccountStatusRoute(app);
  registerOAuthRoutes(app);

  // Server-side redirect for mac zip download (GitHub Release)
  app.get("/downloads/geo-local-agent-mac.zip", (_req, res) => {
    res.redirect(302, "https://github.com/yunmai0622-afk/geo-local-agent-releases/releases/download/geo-local-agent-v1.0.16/geo-local-agent-mac.zip");
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    startDailyAiCheckScheduler();
    startWeeklyGrowthReportScheduler();
  });
}

startServer().catch(console.error);
