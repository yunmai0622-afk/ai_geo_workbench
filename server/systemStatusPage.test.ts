import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 system status page", () => {
  it("exposes GET /api/health and registers route on server boot", () => {
    expect(read("server/healthRoute.ts")).toContain('app.get("/api/health"');
    expect(read("server/_core/index.ts")).toContain("registerHealthRoute");
  });

  it("/status is public and not wired into dashboard nav", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('path="/status"');
    expect(app).toContain("SystemStatusPage");
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).not.toContain("/status");
  });

  it("status page calls /api/health", () => {
    expect(read("client/src/pages/SystemStatusPage.tsx")).toContain('fetch("/api/health"');
  });

  it("health API exposes operations snapshot for monitor", () => {
    expect(read("shared/health.ts")).toContain("operations:");
    expect(read("server/healthChecks.ts")).toContain("checkOperationsHealth");
    expect(read("client/src/pages/SystemStatusPage.tsx")).toContain("最近内容生成");
    expect(read("client/src/pages/SystemStatusPage.tsx")).toContain("发布队列任务数");
  });
});
