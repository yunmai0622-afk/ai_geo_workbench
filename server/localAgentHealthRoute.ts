import type { Express, Request, Response } from "express";
import { LOCAL_AGENT_BASE_URL, LOCAL_AGENT_HEALTH_PATH } from "@shared/localAgent";

const HEALTH_TIMEOUT_MS = 4000;

/** 浏览器经同源代理探测本机 Agent，避免 Console 出现 ERR_CONNECTION_REFUSED */
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
