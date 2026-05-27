import type { Express, Request, Response } from "express";
import { assertAgentApiKeyUser, readAgentApiKeyFromRequest } from "./agentAuth";
import { parseLocalAgentAccountStatusBody, syncLocalAgentAccountStatuses } from "./localAgentAccountSync";

export function registerLocalAgentAccountStatusRoute(app: Express) {
  app.post("/api/local-agent/accounts/status", async (req: Request, res: Response) => {
    try {
      const user = await assertAgentApiKeyUser(readAgentApiKeyFromRequest(req));
      const payload = parseLocalAgentAccountStatusBody(req.body);
      const result = await syncLocalAgentAccountStatuses(user.id, payload);
      res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失败";
      const status = /UNAUTHORIZED|API 密钥|缺少 Agent/.test(message) ? 401 : 400;
      res.status(status).json({ success: false, message });
    }
  });
}
