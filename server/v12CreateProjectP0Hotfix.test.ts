import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CREATE_PROJECT_FAILED_USER_MESSAGE,
  toUserFacingCreateProjectError,
} from "@shared/userFacingMutationErrors";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf-8");

describe("P0 创建项目热修", () => {
  it("App 根路径导向 /clients，/onboarding 为 3 步引导，旧引导保留 legacy", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('<Redirect to="/clients" />');
    expect(app).toContain('path="/legacy/onboarding"');
    expect(app).toContain('path="/onboarding" component={OnboardingPage}');
    expect(app).not.toMatch(/projects\.length === 0[\s\S]{0,200}Redirect to="\/onboarding"/);
    expect(app).not.toContain('<Route path="/" component={Home} />');
  });

  it("服务端 create 捕获数据库错误并返回友好文案", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain("CREATE_PROJECT_FAILED_USER_MESSAGE");
    expect(routers).toContain("[geo.projects.create]");
    expect(routers).toMatch(/create:[\s\S]{0,400}catch \(err\)/);
    expect(routers).not.toMatch(/toast\.error\(err\.message\)/);
  });

  it("启动与 create 前幂等补齐 ownerUserId 列", () => {
    expect(read("server/ensureProjectsOwnerUserId.ts")).toContain("ownerUserId");
    expect(read("server/_core/index.ts")).toContain("ensureProjectsOwnerUserIdColumn");
    expect(read("server/routers.ts")).toContain("ensureProjectsOwnerUserIdColumnOnce");
  });

  it("客户台创建失败使用脱敏 helper", () => {
    const clients = read("client/src/pages/ClientDashboardPage.tsx");
    expect(clients).toContain("toUserFacingCreateProjectError");
    expect(clients).not.toMatch(/toast\.error\(err instanceof Error \? err\.message/);
  });

  it("不向用户透出 Failed query / ownerUserId / params", () => {
    const raw =
      "Failed query: insert into `projects` (`ownerUserId`) values (?)\nparams: 1";
    const msg = toUserFacingCreateProjectError(new Error(raw));
    expect(msg).toBe(CREATE_PROJECT_FAILED_USER_MESSAGE);
    expect(msg).not.toMatch(/Failed query|insert into|ownerUserId|params/i);
  });
});
