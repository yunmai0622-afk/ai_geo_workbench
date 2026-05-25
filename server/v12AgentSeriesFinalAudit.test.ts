import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Agent-Series-Final-Audit static gates", () => {
  it("local HTTP does not expose profilePath on create", () => {
    const server = read("local-agent/src/agent/localServer.ts");
    const block = server.slice(server.indexOf("/profiles/create"), server.indexOf("open-login"));
    expect(block).not.toContain("profilePath: account.profilePath");
  });

  it("GET /accounts HTTP redacts profilePath", () => {
    expect(read("local-agent/src/agent/localServer.ts")).toContain("profilePath: _p");
  });

  it("final acceptance script and delivery docs exist", () => {
    expect(existsSync(resolve(root, "scripts/agent_final_static_acceptance.mjs"))).toBe(true);
    expect(existsSync(resolve(root, "artifacts/AGENT_SERIES_DELIVERY.md"))).toBe(true);
    expect(existsSync(resolve(root, "artifacts/AGENT_SERIES_SCREENSHOTS.md"))).toBe(true);
  });

  it("no password cookie on server bind path", () => {
    expect(read("server/projectPlatformAccounts.ts")).not.toMatch(/profilePath|password|cookie/i);
  });

  it("agent2 status integrity rules in server", () => {
    expect(read("server/agentPublishTasks.ts")).toContain("draft_saved 必须提供");
    expect(read("server/agentPublishTasks.ts")).not.toMatch(/mock.*success/i);
  });
});
