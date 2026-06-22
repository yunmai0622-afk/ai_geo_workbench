import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf-8");

describe("GEO-V1.1-ProjectIdCleanup", () => {
  it("client 源码不含硬编码 projectId 30001", () => {
    const clientSrc = read("client/src/hooks/useActiveProjectSelection.ts") + read("client/src/App.tsx");
    expect(clientSrc).not.toContain("30001");
    expect(read("client/src/lib/activeProject.ts")).toContain("INVALID_PROJECT_MESSAGE");
    expect(read("client/src/lib/activeProject.ts")).toContain("项目不存在");
  });

  it("无效 projectId 时清除缓存并 fallback 到第一个有效项目", () => {
    const redirect = read("client/src/hooks/useInvalidProjectRedirect.ts");
    expect(redirect).toContain("pickFirstAccessibleProjectId");
    expect(redirect).toContain("buildProjectUrl");
    expect(redirect).toContain("INVALID_PROJECT_MESSAGE");
    expect(redirect).toContain("clearActiveProjectId");
    expect(read("client/src/lib/activeProject.ts")).toContain("inspectActiveProjectContext");
    expect(read("client/src/hooks/useActiveProjectSelection.ts")).toContain("useInvalidProjectRedirect");
    expect(read("client/src/App.tsx")).toContain("useInvalidProjectRedirect");
    expect(read("client/src/App.tsx")).toContain("isProjectsListNavigationPending");
    expect(read("client/src/App.tsx")).toContain("isProjectIdAccessible");
  });

  it("审计脚本不再默认 30001", () => {
    const audit = read("scripts/geo_real_data_chain_audit.ts");
    expect(audit).not.toMatch(/PROJECT_ID \?\? ["']30001["']/);
    expect(audit).toContain("需要环境变量 PROJECT_ID");
  });

  it("孤儿 projectId 清理脚本覆盖 publish_tasks 等表", () => {
    const script = read("scripts/geo_cleanup_orphan_project_id.ts");
    expect(script).toContain("publish_tasks");
    expect(script).toContain("content_plan_items");
  });
});
