import { ENV } from "./env";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect as tlsConnect } from "node:tls";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  /** 单次请求超时（毫秒）；OpenAI 直连/代理与 Manus Forge 均会尽力遵守。缺省见 OPENAI_TIMEOUT_MS 或 60000。 */
  timeoutMs?: number;
  timeout_ms?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveManusApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

const assertManusApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }
};

const resolveOpenAIBaseUrl = () =>
  (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/+$/, "");

const resolveOpenAIChatCompletionsPath = () => {
  const path = process.env.OPENAI_CHAT_COMPLETIONS_PATH ?? "/chat/completions";
  return path.startsWith("/") ? path : `/${path}`;
};

const resolveOpenAIApiUrl = () => {
  const baseUrl = resolveOpenAIBaseUrl();
  if (baseUrl.endsWith("/chat/completions")) return baseUrl;
  const chatCompletionsPath = resolveOpenAIChatCompletionsPath();
  if (baseUrl.endsWith("/v1") || baseUrl.endsWith("/api/v3")) return `${baseUrl}${chatCompletionsPath}`;
  return `${baseUrl}/v1${chatCompletionsPath}`;
};

const resolveOpenAITimeoutMs = () => {
  const raw = Number(process.env.OPENAI_TIMEOUT_MS ?? 60000);
  return Number.isFinite(raw) && raw > 0 ? raw : 60000;
};

const proxyEnv = () => {
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const allProxy = process.env.ALL_PROXY || process.env.all_proxy;
  return {
    httpsProxy,
    httpProxy,
    allProxy,
    proxyUrl: httpsProxy || httpProxy || allProxy,
    detected: {
      HTTPS_PROXY: Boolean(httpsProxy),
      HTTP_PROXY: Boolean(httpProxy),
      ALL_PROXY: Boolean(allProxy),
    },
  };
};

const proxyAuthorizationHeader = (proxyUrl: URL) => {
  if (!proxyUrl.username && !proxyUrl.password) return undefined;
  const credentials = `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
};

const assertOpenAIApiKey = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const buildCommonPayload = (params: InvokeParams) => {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    maxTokens,
    max_tokens,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  payload.max_tokens = max_tokens ?? maxTokens ?? 32768;

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  return payload;
};

const normalizeOpenAIResult = (result: InvokeResult): InvokeResult => ({
  id: result.id,
  created: result.created,
  model: result.model,
  choices: result.choices.map(choice => ({
    index: choice.index,
    message: {
      role: choice.message.role,
      content: choice.message.content ?? "",
      ...(choice.message.tool_calls ? { tool_calls: choice.message.tool_calls } : {}),
    },
    finish_reason: choice.finish_reason,
  })),
  ...(result.usage ? { usage: result.usage } : {}),
});

type HttpResult = {
  status: number;
  statusText: string;
  body: string;
};

function openAIErrorContext(input: {
  baseUrl: string;
  requestURL: string;
  model: string;
  timeoutMs: number;
  originalError?: unknown;
}) {
  const { detected } = proxyEnv();
  const original = input.originalError as { code?: string; cause?: { code?: string }; message?: string } | undefined;
  const originalCode = original?.code ?? original?.cause?.code ?? "unknown";
  const originalMessage = original?.message ?? String(input.originalError ?? "");
  return `provider=openai baseURL=${input.baseUrl} requestURL=${input.requestURL} model=${input.model} timeoutMs=${input.timeoutMs} proxyDetected=${JSON.stringify(detected)} originalCode=${originalCode}${originalMessage ? ` originalMessage=${originalMessage}` : ""}`;
}

function requestOpenAIThroughProxy(input: {
  apiUrl: string;
  proxyUrl: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  timeoutMs: number;
}): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(input.apiUrl);
    const proxyUrl = new URL(input.proxyUrl);
    const proxyRequest = proxyUrl.protocol === "https:" ? httpsRequest : httpRequest;
    if (targetUrl.protocol !== "https:") {
      reject(new Error(`OpenAI proxy mode only supports https targets, got ${targetUrl.protocol}`));
      return;
    }
    if (proxyUrl.protocol !== "http:" && proxyUrl.protocol !== "https:") {
      reject(new Error(`Unsupported proxy protocol: ${proxyUrl.protocol}`));
      return;
    }

    const targetPort = targetUrl.port ? Number(targetUrl.port) : 443;
    const proxyPort = proxyUrl.port ? Number(proxyUrl.port) : proxyUrl.protocol === "https:" ? 443 : 80;
    const authHeader = proxyAuthorizationHeader(proxyUrl);
    const connectReq = proxyRequest({
      hostname: proxyUrl.hostname,
      port: proxyPort,
      method: "CONNECT",
      path: `${targetUrl.hostname}:${targetPort}`,
      headers: {
        Host: `${targetUrl.hostname}:${targetPort}`,
        ...(authHeader ? { "Proxy-Authorization": authHeader } : {}),
      },
      timeout: input.timeoutMs,
    });

    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      connectReq.destroy();
      reject(error);
    };
    const timer = setTimeout(() => {
      fail(Object.assign(new Error(`OpenAI request timed out after ${input.timeoutMs}ms`), { code: "OPENAI_TIMEOUT" }));
    }, input.timeoutMs);

    connectReq.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        fail(Object.assign(new Error(`Proxy CONNECT failed with status ${res.statusCode}`), { code: "PROXY_CONNECT_FAILED" }));
        return;
      }

      const secureSocket = tlsConnect({
        socket,
        servername: targetUrl.hostname,
      }, () => {
        const body = JSON.stringify(input.payload);
        const path = `${targetUrl.pathname}${targetUrl.search}`;
        const headers = {
          ...input.headers,
          Host: targetUrl.host,
          "Content-Length": Buffer.byteLength(body).toString(),
          Connection: "close",
        };
        const headerText = Object.entries(headers)
          .map(([key, value]) => `${key}: ${value}`)
          .join("\r\n");
        secureSocket.write(`POST ${path} HTTP/1.1\r\n${headerText}\r\n\r\n${body}`);
      });

      const chunks: Buffer[] = [];
      secureSocket.setTimeout(input.timeoutMs, () => {
        secureSocket.destroy(Object.assign(new Error(`OpenAI request timed out after ${input.timeoutMs}ms`), { code: "OPENAI_TIMEOUT" }));
      });
      secureSocket.on("data", chunk => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      secureSocket.on("error", fail);
      secureSocket.on("end", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const raw = Buffer.concat(chunks).toString("utf8");
        const separator = raw.indexOf("\r\n\r\n");
        const header = separator >= 0 ? raw.slice(0, separator) : raw;
        const body = separator >= 0 ? raw.slice(separator + 4) : "";
        const [statusLine] = header.split("\r\n");
        const match = /^HTTP\/\d(?:\.\d)?\s+(\d+)\s*(.*)$/.exec(statusLine ?? "");
        resolve({
          status: match ? Number(match[1]) : 0,
          statusText: match?.[2] ?? "",
          body,
        });
      });
    });
    connectReq.on("timeout", () => {
      fail(Object.assign(new Error(`OpenAI request timed out after ${input.timeoutMs}ms`), { code: "OPENAI_TIMEOUT" }));
    });
    connectReq.on("error", fail);
    connectReq.end();
  });
}

function requestOpenAIDirect(input: {
  apiUrl: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  timeoutMs: number;
}): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(input.apiUrl);
    const body = JSON.stringify(input.payload);
    const requestImpl = targetUrl.protocol === "https:" ? httpsRequest : httpRequest;
    const req = requestImpl({
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port ? Number(targetUrl.port) : targetUrl.protocol === "https:" ? 443 : 80,
      method: "POST",
      path: `${targetUrl.pathname}${targetUrl.search}`,
      headers: {
        ...input.headers,
        "Content-Length": Buffer.byteLength(body).toString(),
      },
      timeout: input.timeoutMs,
    }, response => {
      const chunks: Buffer[] = [];
      response.on("data", chunk => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on("end", () => {
        resolve({
          status: response.statusCode ?? 0,
          statusText: response.statusMessage ?? "",
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });

    const timer = setTimeout(() => {
      req.destroy(Object.assign(new Error(`OpenAI request timed out after ${input.timeoutMs}ms`), { code: "OPENAI_TIMEOUT" }));
    }, input.timeoutMs);

    req.on("timeout", () => {
      req.destroy(Object.assign(new Error(`OpenAI request timed out after ${input.timeoutMs}ms`), { code: "OPENAI_TIMEOUT" }));
    });
    req.on("error", error => {
      clearTimeout(timer);
      reject(error);
    });
    req.on("close", () => {
      clearTimeout(timer);
    });
    req.write(body);
    req.end();
  });
}

async function requestOpenAI(input: {
  apiUrl: string;
  payload: Record<string, unknown>;
  model: string;
  timeoutMs: number;
}): Promise<HttpResult> {
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  };
  const { proxyUrl } = proxyEnv();
  if (proxyUrl) {
    return requestOpenAIThroughProxy({
      apiUrl: input.apiUrl,
      proxyUrl,
      payload: input.payload,
      headers,
      timeoutMs: input.timeoutMs,
    });
  }

  return requestOpenAIDirect({
    apiUrl: input.apiUrl,
    payload: input.payload,
    headers,
    timeoutMs: input.timeoutMs,
  });
}

async function invokeManusForge(params: InvokeParams): Promise<InvokeResult> {
  assertManusApiKey();

  const timeoutMs = params.timeoutMs ?? params.timeout_ms ?? resolveOpenAITimeoutMs();
  const controller = new AbortController();
  const killTimer = setTimeout(() => controller.abort(), timeoutMs);

  const payload = {
    model: "gemini-2.5-flash",
    ...buildCommonPayload(params),
    thinking: {
      budget_tokens: 128,
    },
  };

  let response: Response;
  try {
    response = await fetch(resolveManusApiUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      throw new Error(`LLM invoke timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(killTimer);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}

async function invokeOpenAI(params: InvokeParams): Promise<InvokeResult> {
  assertOpenAIApiKey();
  const baseUrl = resolveOpenAIBaseUrl();
  const apiUrl = resolveOpenAIApiUrl();
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const timeoutMs = params.timeoutMs ?? params.timeout_ms ?? resolveOpenAITimeoutMs();

  const payload = {
    model,
    ...buildCommonPayload(params),
  };

  let response: HttpResult;
  try {
    response = await requestOpenAI({ apiUrl, payload, model, timeoutMs });
  } catch (error) {
    throw new Error(`OpenAI LLM network failure: ${openAIErrorContext({ baseUrl, requestURL: apiUrl, model, timeoutMs, originalError: error })}`);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `OpenAI LLM invoke failed: ${openAIErrorContext({ baseUrl, requestURL: apiUrl, model, timeoutMs })} status=${response.status} ${response.statusText} – ${response.body}`
    );
  }

  return normalizeOpenAIResult(JSON.parse(response.body) as InvokeResult);
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const provider = process.env.LLM_PROVIDER ?? "openai";
  if (provider === "openai") {
    return invokeOpenAI(params);
  }
  return invokeManusForge(params);
}
