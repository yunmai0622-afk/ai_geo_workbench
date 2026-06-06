import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf-8");

describe("localAgentHealthRoute", () => {
  it("registers same-origin health proxy and browser direct localhost health probe", () => {
    const route = read("server/localAgentHealthRoute.ts");
    const index = read("server/_core/index.ts");
    const client = read("client/src/lib/localAgentClient.ts");
    const shared = read("shared/localAgent.ts");

    expect(route).toContain('app.get("/api/local-agent/health"');
    expect(route).toContain("LOCAL_AGENT_BASE_URL");
    expect(route).toContain("LOCAL_AGENT_HEALTH_PATH");
    expect(index).toContain("registerLocalAgentHealthRoute");
    expect(shared).toContain("LOCAL_AGENT_DIRECT_HEALTH_URL");
    expect(shared).toContain('LOCAL_AGENT_BROWSER_HEALTH_URL = "/api/local-agent/health"');
    expect(client).toContain("LOCAL_AGENT_DIRECT_HEALTH_URL");
    expect(client).toMatch(/fetch\(LOCAL_AGENT_DIRECT_HEALTH_URL/);
    expect(client).toContain("healthProbeCache");
  });
});
