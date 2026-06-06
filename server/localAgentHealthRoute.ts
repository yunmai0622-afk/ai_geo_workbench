import type { Express, Request, Response } from "express";
import { LOCAL_AGENT_BASE_URL, LOCAL_AGENT_HEALTH_PATH } from "@shared/localAgent";

const HEALTH_TIMEOUT_MS = 4000;

/**
 * 同源代理：仅在同机部署时有效（dev server 与 Agent 同机）。
 * 远端生产环境浏览器应直连 http://127.0.0.1:39888/health，勿依赖此路由判断用户 Agent 在线。
 */
export function registerLocalAgentHealthRoute(app: Express) {
  app.get("/api/local-agent/health", async (_req: Request, res: Response) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      const upstream = await fetch(`${LOCAL_AGENT_BASE_URL}${LOCAL_AGENT_HEALTH_PATH}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      if (!upstream.ok) {
        res.status(200).json({ ok: false });
        return;
      }
      const data = (await upstream.json()) as { ok?: boolean };
      res.status(200).json(data);
    } catch {
      res.status(200).json({ ok: false });
    }
  });
}
