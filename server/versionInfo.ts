import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAppVersion } from "./healthChecks";

export type RuntimeVersionInfo = {
  ok: true;
  version: string;
  commit: string;
  buildTime: string;
  environment: string;
  source: "runtime";
  deployment?: {
    provider: "railway";
    id?: string;
    service?: string;
    environment?: string;
  };
};

type GeneratedVersionInfo = {
  version?: unknown;
  commit?: unknown;
  buildTime?: unknown;
  environment?: unknown;
};

const DEPLOY_COMMIT_ENV_KEYS = [
  "RAILWAY_GIT_COMMIT_SHA",
  "GITHUB_SHA",
] as const;

const FALLBACK_COMMIT_ENV_KEYS = [
  "SOURCE_VERSION",
  "COMMIT_SHA",
  "GIT_COMMIT",
] as const;

const BUILD_TIME_ENV_KEYS = ["RAILWAY_BUILD_TIME"] as const;
const FALLBACK_BUILD_TIME_ENV_KEYS = ["BUILD_TIME"] as const;

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstEnv(keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = readString(process.env[key]);
    if (value) return value;
  }
  return null;
}

function readGeneratedVersionInfo(): GeneratedVersionInfo {
  const candidates = [
    resolve(process.cwd(), "dist", "public", "__manus__", "version.json"),
    resolve(process.cwd(), "dist", "public", "version.json"),
    resolve(process.cwd(), "client", "public", "__manus__", "version.json"),
  ];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      return JSON.parse(readFileSync(file, "utf8")) as GeneratedVersionInfo;
    } catch {
      return {};
    }
  }

  return {};
}

export function buildRuntimeVersionInfo(now: Date = new Date()): RuntimeVersionInfo {
  const generated = readGeneratedVersionInfo();
  const deploymentId = readString(process.env.RAILWAY_DEPLOYMENT_ID);
  const service = readString(process.env.RAILWAY_SERVICE_NAME);
  const railwayEnvironment = readString(process.env.RAILWAY_ENVIRONMENT_NAME);
  const deployment =
    deploymentId || service || railwayEnvironment
      ? {
          provider: "railway" as const,
          ...(deploymentId ? { id: deploymentId } : {}),
          ...(service ? { service } : {}),
          ...(railwayEnvironment ? { environment: railwayEnvironment } : {}),
        }
      : undefined;

  return {
    ok: true,
    version: getAppVersion(),
    commit:
      firstEnv(DEPLOY_COMMIT_ENV_KEYS) ??
      readString(generated.commit) ??
      firstEnv(FALLBACK_COMMIT_ENV_KEYS) ??
      "unknown",
    buildTime:
      firstEnv(BUILD_TIME_ENV_KEYS) ??
      readString(generated.buildTime) ??
      firstEnv(FALLBACK_BUILD_TIME_ENV_KEYS) ??
      now.toISOString(),
    environment:
      readString(process.env.NODE_ENV) ??
      railwayEnvironment ??
      readString(generated.environment) ??
      "unknown",
    source: "runtime",
    ...(deployment ? { deployment } : {}),
  };
}
