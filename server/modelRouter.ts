/**
 * 模型任务路由（C8-A）：质检与正文生成共用 volcengine（OPENAI_*），可经 QUALITY_REVIEW_MODEL 切换
 */

export type ModelTask =
  | "draft_generation"
  | "diagnosis"
  | "quality_review"
  | "rewrite"
  | "report";

export type ModelProviderName = "deepseek" | "claude" | "gpt" | "volcengine";

export interface ModelClient {
  name: string;
  call(prompt: string, systemPrompt?: string): Promise<string>;
}

const TASK_DEFAULT_PROVIDER: Record<ModelTask, ModelProviderName> = {
  draft_generation: "volcengine",
  diagnosis: "deepseek",
  quality_review: "volcengine",
  rewrite: "deepseek",
  report: "deepseek",
};

function resolveProviderFromEnv(task: ModelTask): ModelProviderName {
  if (task === "quality_review") {
    const raw = process.env.QUALITY_REVIEW_MODEL?.trim().toLowerCase();
    const v = raw || TASK_DEFAULT_PROVIDER.quality_review;
    if (v === "claude" || v === "gpt" || v === "deepseek" || v === "volcengine") return v;
    return TASK_DEFAULT_PROVIDER.quality_review;
  }
  if (task === "report") {
    const raw = process.env.REPORT_MODEL?.trim().toLowerCase();
    const v = raw || TASK_DEFAULT_PROVIDER.report;
    if (v === "claude" || v === "gpt" || v === "deepseek" || v === "volcengine") return v;
    return TASK_DEFAULT_PROVIDER.report;
  }
  return TASK_DEFAULT_PROVIDER[task];
}

async function chatCompletionsRequest(config: {
  apiUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
}): Promise<string> {
  if (!config.apiKey) {
    throw new Error("模型 API Key 未配置");
  }
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (config.systemPrompt?.trim()) {
    messages.push({ role: "system", content: config.systemPrompt.trim() });
  }
  messages.push({ role: "user", content: config.prompt });

  const res = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: 2500,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`模型请求失败 HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new Error("模型返回内容为空");
  return content.trim();
}

function volcengineChatConfig() {
  const apiUrl = process.env.OPENAI_BASE_URL
    ? `${process.env.OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`
    : "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
  return {
    apiUrl,
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "ep-20251210143333-s6bb7",
  };
}

function deepseekChatConfig() {
  const base = volcengineChatConfig();
  return {
    ...base,
    model: process.env.ARK_DEEPSEEK_MODEL_ID ?? process.env.OPENAI_MODEL ?? base.model,
  };
}

export function createDefaultModelClients(): Record<ModelProviderName, ModelClient> {
  return {
    volcengine: {
      name: "volcengine",
      call: (prompt, systemPrompt) => chatCompletionsRequest({ ...volcengineChatConfig(), prompt, systemPrompt }),
    },
    deepseek: {
      name: "deepseek",
      call: (prompt, systemPrompt) => chatCompletionsRequest({ ...deepseekChatConfig(), prompt, systemPrompt }),
    },
    claude: {
      name: "claude",
      call: async () => {
        throw new Error("Claude 模型即将支持");
      },
    },
    gpt: {
      name: "gpt",
      call: async () => {
        throw new Error("GPT 模型即将支持");
      },
    },
  };
}

export class ModelRouter {
  private clients: Record<ModelProviderName, ModelClient>;

  constructor(clients?: Partial<Record<ModelProviderName, ModelClient>>) {
    this.clients = { ...createDefaultModelClients(), ...clients };
  }

  getProviderForTask(task: ModelTask): ModelProviderName {
    return resolveProviderFromEnv(task);
  }

  getModel(task: ModelTask): ModelClient {
    const provider = this.getProviderForTask(task);
    const client = this.clients[provider];
    if (!client) throw new Error(`未知模型提供商: ${provider}`);
    return client;
  }

  async callModel(
    task: ModelTask,
    prompt: string,
    options?: { systemPrompt?: string },
  ): Promise<{ text: string; modelName: string }> {
    const client = this.getModel(task);
    const text = await client.call(prompt, options?.systemPrompt);
    return { text, modelName: client.name };
  }
}

export const defaultModelRouter = new ModelRouter();
