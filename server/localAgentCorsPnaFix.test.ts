import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classifyLocalAgentFetchFailure } from "../client/src/lib/localAgentClient";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("localAgent CORS / PNA P0", () => {
  const localServer = read("local-agent/src/agent/localServer.ts");
  const cors = read("local-agent/src/agent/cors.ts");
  const client = read("client/src/lib/localAgentClient.ts");
  const card = read("client/src/components/LocalAgentDownloadCard.tsx");

  it("local agent HTTP server exposes CORS + Private Network Access headers", () => {
    expect(cors).toContain("Access-Control-Allow-Private-Network");
    expect(cors).toContain("https://aigeoworkbench00-production.up.railway.app");
    expect(cors).toContain("http://localhost:5173");
    expect(localServer).toContain("sendOptions");
    expect(localServer).toContain("buildLocalAgentCorsHeaders");
    expect(localServer).toContain("/health");
    expect(localServer).toContain("/accounts");
  });

  it("browser direct health probe captures fetch debug fields", () => {
    expect(client).toContain("probeLocalAgentHealthDetailed");
    expect(client).toContain("isCorsLikely");
    expect(client).toContain("isPrivateNetworkLikely");
    expect(client).toContain("Access-Control-Request-Private-Network");
    expect(card).toContain("fetchStatus");
    expect(card).toContain("preflightAllowPrivateNetwork");
    expect(card).toContain("responseBodySummary");
  });

  it("classifyLocalAgentFetchFailure flags missing Private-Network preflight", () => {
    const result = classifyLocalAgentFetchFailure({
      fetchErrorName: "TypeError",
      fetchErrorMessage: "Failed to fetch",
      pageOrigin: "https://aigeoworkbench00-production.up.railway.app",
      preflightAllowOrigin: "https://aigeoworkbench00-production.up.railway.app",
      preflightAllowPrivateNetwork: null,
      preflightStatus: 204,
    });
    expect(result.isPrivateNetworkLikely).toBe(true);
  });

  it("verify script checks OPTIONS preflight headers", () => {
    const script = read("scripts/verify_local_agent_browser_direct.mjs");
    expect(script).toContain("Access-Control-Request-Private-Network");
    expect(script).toContain("Access-Control-Allow-Private-Network");
    expect(script).toContain("Access-Control-Allow-Origin");
  });
});
