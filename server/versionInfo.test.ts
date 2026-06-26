import { afterEach, describe, expect, it } from "vitest";
import { buildRuntimeVersionInfo } from "./versionInfo";

const KEYS = [
  "GIT_COMMIT",
  "RAILWAY_GIT_COMMIT_SHA",
  "GITHUB_SHA",
  "BUILD_TIME",
  "NODE_ENV",
  "RAILWAY_ENVIRONMENT_NAME",
  "RAILWAY_DEPLOYMENT_ID",
  "RAILWAY_SERVICE_NAME",
] as const;

const previous = new Map<string, string | undefined>();

for (const key of KEYS) {
  previous.set(key, process.env[key]);
}

afterEach(() => {
  for (const key of KEYS) {
    const value = previous.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("buildRuntimeVersionInfo", () => {
  it("uses non-secret deployment metadata from environment variables", () => {
    process.env.GIT_COMMIT = "05ceb68b9493f3aa678057cd25587fff5d902b39";
    process.env.BUILD_TIME = "2026-06-26T10:00:00Z";
    process.env.NODE_ENV = "production";
    process.env.RAILWAY_DEPLOYMENT_ID = "deployment-id";
    process.env.RAILWAY_SERVICE_NAME = "geo-web";
    process.env.RAILWAY_ENVIRONMENT_NAME = "production";

    const info = buildRuntimeVersionInfo(new Date("2026-06-26T11:00:00Z"));

    expect(info.ok).toBe(true);
    expect(info.commit).toBe("05ceb68b9493f3aa678057cd25587fff5d902b39");
    expect(info.buildTime).toBe("2026-06-26T10:00:00Z");
    expect(info.environment).toBe("production");
    expect(info.deployment).toEqual({
      provider: "railway",
      id: "deployment-id",
      service: "geo-web",
      environment: "production",
    });
  });
});
