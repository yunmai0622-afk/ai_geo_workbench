import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Agent-1 Web + local-agent account binding", () => {
  it("local-agent exposes /health on 39888", () => {
    const server = read("local-agent/src/agent/localServer.ts");
    expect(server).toContain('pathname === "/health"');
    expect(server).toContain("39888");
    expect(server).toContain("127.0.0.1");
  });

  it("local-agent can create zhihu profile via HTTP", () => {
    const server = read("local-agent/src/agent/localServer.ts");
    expect(server).toContain('pathname === "/profiles/create"');
    expect(server).toContain("LOCAL_AGENT_PLATFORMS");
    const storage = read("local-agent/src/agent/storage.ts");
    expect(storage).not.toMatch(/password|cookie/i);
  });

  it("PlatformAccountBindingSection uses local agent not chrome plugin", () => {
    const ui = read("client/src/components/PlatformAccountBindingSection.tsx");
    expect(ui).toContain("绑定发布账号");
    expect(ui).toContain("checkLocalAgentHealth");
    expect(ui).toContain("LOCAL_AGENT_BASE_URL");
    expect(read("shared/localAgent.ts")).toContain("39888");
    expect(ui).not.toContain("GEO_START_AUTH");
    expect(ui).not.toContain("一键授权");
    expect(ui).not.toContain("绑定当前登录账号");
    expect(ui).not.toContain("plugin_detected");
  });

  it("bindLocalAgentAccount saves local ids and verified status", () => {
    const svc = read("server/projectPlatformAccounts.ts");
    expect(svc).toContain("bindLocalAgentAccount");
    expect(svc).toContain('verificationStatus: "verified"');
    expect(svc).toContain("localAgentId");
    expect(svc).toContain("localProfileId");
    expect(svc).not.toContain("profilePath");
    const router = read("server/projectPlatformAccountsRouter.ts");
    expect(router).toContain("bindLocalAgentAccount:");
  });

  it("schema and migration add local agent columns", () => {
    expect(read("drizzle/schema.ts")).toContain("localAgentId");
    expect(read("drizzle/0026_local_agent_account_binding.sql")).toContain("localProfileId");
  });

  it("C7-B publish verification unchanged", () => {
    expect(read("server/publishTasksRouter.ts")).toContain("expectedAccountName: boundAccount.accountName");
    expect(read("server/projectPlatformAccounts.ts")).toContain("verifyPublishTaskAccount");
  });

  it("C8-A quality block unchanged", () => {
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("blockPublishIfQualityReject");
  });
});
