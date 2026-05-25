import http from "http";
import { URL } from "url";
import { AGENT_VERSION, loadOrCreateAgentMeta } from "./agentMeta";
import { detectPlatformAccount, openLoginWindow } from "./platformActions";
import { LOCAL_AGENT_PLATFORMS } from "./platforms/publisherFactory";
import { createPlatformProfile } from "./profileManager";
import { readAccounts } from "./storage";

export const LOCAL_AGENT_HOST = "127.0.0.1";
export const LOCAL_AGENT_PORT = 39888;

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(payload);
}

async function readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw.trim()) return {} as T;
  return JSON.parse(raw) as T;
}

export function startLocalAgentServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    if (!req.url || !req.method) {
      sendJson(res, 400, { ok: false, message: "bad_request" });
      return;
    }

    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    const url = new URL(req.url, `http://${LOCAL_AGENT_HOST}:${LOCAL_AGENT_PORT}`);
    const pathname = url.pathname;

    try {
      if (req.method === "GET" && pathname === "/health") {
        const meta = loadOrCreateAgentMeta();
        sendJson(res, 200, {
          ok: true,
          agentId: meta.agentId,
          version: AGENT_VERSION,
          platform: process.platform,
          startedAt: meta.lastStartedAt,
          supportedPlatforms: LOCAL_AGENT_PLATFORMS,
        });
        return;
      }

      if (req.method === "GET" && pathname === "/accounts") {
        const data = readAccounts();
        sendJson(res, 200, {
          accounts: data.accounts.map(({ profilePath: _p, ...rest }) => rest),
        });
        return;
      }

      if (req.method === "POST" && pathname === "/profiles/create") {
        const body = await readJsonBody<{
          platform?: string;
          projectId?: number;
          accountRole?: string | null;
          accountGroup?: string | null;
        }>(req);
        const platform = body.platform as (typeof LOCAL_AGENT_PLATFORMS)[number] | undefined;
        if (!platform || !LOCAL_AGENT_PLATFORMS.includes(platform)) {
          sendJson(res, 400, {
            ok: false,
            message: `platform 须为 ${LOCAL_AGENT_PLATFORMS.join(" / ")} 之一`,
          });
          return;
        }
        const account = createPlatformProfile(platform, {
          projectId: body.projectId,
          accountRole: body.accountRole ?? null,
          accountGroup: body.accountGroup ?? null,
        });
        sendJson(res, 200, {
          profileId: account.profileId,
          platform: account.platform,
          sessionStatus: account.sessionStatus,
        });
        return;
      }

      const openLoginMatch = pathname.match(/^\/profiles\/([^/]+)\/open-login$/);
      if (req.method === "POST" && openLoginMatch) {
        const profileId = decodeURIComponent(openLoginMatch[1]!);
        const result = await openLoginWindow(profileId);
        sendJson(res, result.ok ? 200 : 400, {
          ok: result.ok,
          profileId,
          message: result.message,
          step: result.step,
        });
        return;
      }

      if (req.method === "POST" && pathname === "/poll-once") {
        const { pollOnce } = await import("./pollingManager");
        const result = await pollOnce();
        sendJson(res, 200, { ok: true, ...result });
        return;
      }

      const detectMatch = pathname.match(/^\/profiles\/([^/]+)\/detect-account$/);
      if (req.method === "POST" && detectMatch) {
        const profileId = decodeURIComponent(detectMatch[1]!);
        const result = await detectPlatformAccount(profileId);
        const acc = readAccounts().accounts.find(a => a.profileId === profileId);
        if (!result.ok) {
          const errorType =
            result.step === "login_required"
              ? "login_required"
              : result.step === "page_context_lost"
                ? "page_context_lost"
                : result.step === "account_mismatch"
                  ? "account_mismatch"
                  : result.step === "selector_not_found"
                    ? "selector_not_found"
                    : "account_not_detected";
          sendJson(res, 400, {
            ok: false,
            errorType,
            message: result.message,
            profileId,
            platform: acc?.platform,
          });
          return;
        }
        sendJson(res, 200, {
          ok: true,
          profileId,
          platform: acc?.platform ?? null,
          accountName: result.data?.accountName ?? null,
          sessionStatus: "active",
        });
        return;
      }

      sendJson(res, 404, { ok: false, message: "not_found" });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("profile_not_found")) {
        sendJson(res, 404, { ok: false, errorType: "profile_not_found", message });
        return;
      }
      sendJson(res, 500, { ok: false, message });
    }
  });

  server.on("error", err => {
    console.error(`[local-agent] HTTP listen error:`, err);
  });

  server.listen(LOCAL_AGENT_PORT, LOCAL_AGENT_HOST, () => {
    console.log(`[local-agent] HTTP http://${LOCAL_AGENT_HOST}:${LOCAL_AGENT_PORT}`);
  });

  return server;
}
