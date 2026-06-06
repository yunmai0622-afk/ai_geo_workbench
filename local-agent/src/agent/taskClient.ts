import { syncServerHeartbeatOnConnect } from "./accountSync";
import { readAgentConfig } from "./agentConfig";
import { formatGeoServerConnectionError } from "./localAgentServerUrl";

function rethrowFriendly(error: unknown): never {
  const { serverUrl } = readAgentConfig();
  const { userMessage } = formatGeoServerConnectionError(error, serverUrl);
  throw new Error(userMessage);
}

export type PollTaskItem = {
  taskId: number;
  projectId: number;
  articleId: number;
  platform: string;
  platformAccountId: number | null;
  expectedAccountName: string | null;
  localProfileId: string;
  title: string;
  content: string;
  coverBase64?: string;
  coverImageUrl?: string | null;
  action: "save_draft" | "publish";
};

type TrpcJsonEnvelope<T> = {
  result?: { data?: { json?: T } };
  error?: { json?: { message?: string } };
};

function headers(apiKey: string): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (apiKey.trim()) h["x-agent-api-key"] = apiKey.trim();
  return h;
}

async function trpcQuery<T>(procedure: string, input: unknown): Promise<T> {
  const { serverUrl, agentApiKey } = readAgentConfig();
  const q = encodeURIComponent(JSON.stringify({ json: input }));
  const url = `${serverUrl}/api/trpc/${procedure}?input=${q}`;
  try {
    const res = await fetch(url, { headers: headers(agentApiKey) });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`连接失败 HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
    }
    const body = (await res.json()) as TrpcJsonEnvelope<T>;
    if (body.error?.json?.message) throw new Error(body.error.json.message);
    const data = body.result?.data?.json;
    if (data === undefined) throw new Error("服务端返回格式异常");
    return data;
  } catch (e) {
    rethrowFriendly(e);
  }
}

async function trpcMutation<T>(procedure: string, input: unknown): Promise<T> {
  const { serverUrl, agentApiKey } = readAgentConfig();
  const url = `${serverUrl}/api/trpc/${procedure}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: headers(agentApiKey),
      body: JSON.stringify({ json: input }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`请求失败 HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
    }
    const body = (await res.json()) as TrpcJsonEnvelope<T>;
    if (body.error?.json?.message) throw new Error(body.error.json.message);
    const data = body.result?.data?.json;
    if (data === undefined) throw new Error("服务端返回格式异常");
    return data;
  } catch (e) {
    rethrowFriendly(e);
  }
}

export async function pollTasks(localAgentId: string): Promise<{ tasks: PollTaskItem[] }> {
  return trpcQuery("agent.pollTasks", { localAgentId });
}

export async function claimTask(taskId: number, localAgentId: string) {
  return trpcMutation<{ ok: boolean; taskId: number; status: string }>("agent.claimTask", {
    taskId,
    localAgentId,
  });
}

export type ReportTaskInput = {
  taskId: number;
  localAgentId: string;
  status: "draft_saved" | "completed" | "failed" | "session_expired" | "manual_required";
  publicUrl?: string | null;
  draftUrl?: string | null;
  errorType?: string | null;
  errorMessage?: string | null;
  logs?: string[] | null;
};

export async function reportTaskResult(input: ReportTaskInput) {
  return trpcMutation<{ ok: boolean; taskId: number; status: string }>("agent.reportTaskResult", input);
}

export type AgentTaskRow = {
  id: number;
  projectId: number;
  articleId: number;
  platform: string;
  status: string;
  expectedAccountName: string | null;
  localProfileId: string | null;
  articleTitle: string;
  agentPickedAt: string | null;
  agentFinishedAt: string | null;
  agentErrorType: string | null;
  agentErrorMessage: string | null;
  createdAt: string;
  draftUrl: string | null;
  resultUrl: string | null;
};

export async function listAgentTasks(
  localAgentId: string,
  limit = 50,
): Promise<{ tasks: AgentTaskRow[] }> {
  return trpcQuery("agent.listTasks", { localAgentId, limit });
}

export async function testServerConnection(): Promise<{
  ok: boolean;
  message: string;
  diagnosticDetail?: string;
}> {
  const cfg = readAgentConfig();
  try {
    await pollTasks(cfg.localAgentId);
    await syncServerHeartbeatOnConnect({ force: true });
    return { ok: true, message: `已连接 ${cfg.serverUrl}` };
  } catch (e) {
    const { userMessage, diagnosticDetail } = formatGeoServerConnectionError(e, cfg.serverUrl);
    return {
      ok: false,
      message: userMessage,
      diagnosticDetail: diagnosticDetail !== userMessage ? diagnosticDetail : undefined,
    };
  }
}
