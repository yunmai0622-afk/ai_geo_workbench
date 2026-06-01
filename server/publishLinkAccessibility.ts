import { LOCAL_AGENT_DEV_SERVER_URL } from "@shared/localAgentServerUrl";
import type { PublishLinkAccessSnapshot } from "@shared/inclusionMonitoringDisplay";

const DEFAULT_TIMEOUT_MS = 8_000;

export function resolvePublishLinkAbsoluteUrl(publicUrl: string, baseUrl?: string): string | null {
  const trimmed = publicUrl.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!trimmed.startsWith("/")) return null;
  const base = (baseUrl ?? resolveDefaultProbeBaseUrl()).replace(/\/$/, "");
  return `${base}${trimmed}`;
}

function resolveDefaultProbeBaseUrl(): string {
  const fromEnv = process.env.GEO_WEB_BASE_URL?.trim();
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) return fromEnv.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") return LOCAL_AGENT_DEV_SERVER_URL;
  const port = process.env.PORT?.trim() || "3000";
  return `http://127.0.0.1:${port}`;
}

export async function probePublishLinkAccessibility(
  publicUrl: string,
  options?: { baseUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch },
): Promise<PublishLinkAccessSnapshot> {
  const checkedAt = new Date().toISOString();
  const absoluteUrl = resolvePublishLinkAbsoluteUrl(publicUrl, options?.baseUrl);
  if (!absoluteUrl) {
    return {
      accessible: false,
      checkedAt,
      statusCode: null,
      errorMessage: "链接为空或格式无效",
    };
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response = await fetchImpl(absoluteUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    }).catch(() => null);

    if (!response || response.status === 405 || response.status === 501) {
      response = await fetchImpl(absoluteUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { Range: "bytes=0-0" },
      });
    }

    const statusCode = response.status;
    const accessible = response.ok || (statusCode >= 200 && statusCode < 400);
    return {
      accessible,
      checkedAt,
      statusCode,
      errorMessage: accessible ? null : `HTTP ${statusCode}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "链接检测失败";
    return {
      accessible: false,
      checkedAt,
      statusCode: null,
      errorMessage: message,
    };
  } finally {
    clearTimeout(timer);
  }
}
