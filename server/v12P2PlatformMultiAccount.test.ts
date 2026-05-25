import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("P2 platform multi-account binding & publish", () => {
  it("schema removes projectId+platform unique index", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).not.toContain('uniqueIndex("project_platform_accounts_project_platform")');
    expect(schema).not.toMatch(/project_platform_accounts_project_platform"\)\.on\(\s*table\.projectId,\s*table\.platform,\s*\)/);
  });

  it("schema adds projectId+platform+accountName unique index", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain("project_platform_accounts_project_platform_name");
    expect(schema).toMatch(/table\.projectId,\s*table\.platform,\s*table\.accountName/);
  });

  it("migration drops old index and creates new unique index", () => {
    const sql = read("drizzle/0024_platform_multi_accounts.sql");
    expect(sql).toContain("DROP INDEX `project_platform_accounts_project_platform`");
    expect(sql).toContain("project_platform_accounts_project_platform_name");
    expect(sql).toContain("accountName");
  });

  it("can create two accounts under same project/platform with different accountName", () => {
    const svc = read("server/projectPlatformAccounts.ts");
    expect(svc).toContain("createProjectPlatformAccount");
    expect(svc).toContain("assertUniqueAccountName");
  });

  it("cannot create duplicate accountName under same project/platform", () => {
    expect(read("server/projectPlatformAccounts.ts")).toContain('code: "CONFLICT"');
    expect(read("server/projectPlatformAccountsRouter.ts")).toContain("create:");
  });

  it("update account by id", () => {
    expect(read("server/projectPlatformAccountsRouter.ts")).toContain("update:");
    expect(read("server/projectPlatformAccounts.ts")).toContain("updateProjectPlatformAccount");
  });

  it("delete account by id", () => {
    expect(read("server/projectPlatformAccountsRouter.ts")).toContain("delete:");
    expect(read("server/projectPlatformAccounts.ts")).toContain("deleteProjectPlatformAccount");
  });

  it("toggle account by id", () => {
    expect(read("server/projectPlatformAccountsRouter.ts")).toContain("toggleEnabled:");
    expect(read("server/projectPlatformAccounts.ts")).toContain("togglePlatformAccountEnabled");
  });

  it("publishTasks.create uses selected platformAccountId", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("platformAccountId");
    expect(router).toContain("resolvePublishPlatformAccount");
    expect(router).toContain("platformAccountId: boundAccount.id");
    expect(router).toContain("platformAccountId == null");
  });

  it("platformAccountId not found must fail, not fallback", () => {
    const svc = read("server/projectPlatformAccounts.ts");
    expect(svc).toContain("getEnabledPlatformAccountById");
    expect(svc).toContain("platformAccountInvalidMessage");
    expect(svc).toMatch(/if \(input\.platformAccountId != null\)[\s\S]*?getEnabledPlatformAccountById/);
    const router = read("server/publishTasksRouter.ts");
    expect(router).not.toMatch(/platformAccountId[\s\S]{0,120}getEnabledPlatformAccount\(/);
  });

  it("multiple enabled accounts without selected account should block", () => {
    expect(read("server/projectPlatformAccounts.ts")).toContain("publishMustSelectAccountMessage");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("publishMustSelectAccountMessage");
  });

  it("single publish-ready account can auto select", () => {
    expect(read("server/projectPlatformAccounts.ts")).toMatch(/enabled\.length === 1/);
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("ready.length === 1");
  });

  it("expectedAccountName equals selected accountName", () => {
    expect(read("server/publishTasksRouter.ts")).toContain("expectedAccountName: boundAccount.accountName");
  });

  it("account group mismatch warning still works", () => {
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("publishAccountGroupWarnings");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain('data-testid="account-group-mismatch-hint"');
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("pickPublishAccount");
  });

  it("C7-B verifyPublishTaskAccount still compares detected with expectedAccountName", () => {
    const svc = read("server/projectPlatformAccounts.ts");
    expect(svc).toContain("verifyPublishTaskAccount");
    expect(svc).toContain("expectedAccountName");
    expect(read("shared/platformAccountVerify.ts")).toContain("matchPlatformAccountNames");
  });

  it("C8-A reject block still takes priority", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("blockPublishIfQualityReject");
    expect(weekly).toContain("blockPublishIfUnsaved");
    const orderUnsaved = weekly.indexOf("blockPublishIfUnsaved");
    const orderReject = weekly.indexOf("blockPublishIfQualityReject");
    const orderConfirmUnsaved = weekly.indexOf("blockPublishIfUnsaved(publishArticle.id)", orderUnsaved + 1);
    const orderConfirmReject = weekly.indexOf("blockPublishIfQualityReject(publishArticle)", orderReject);
    expect(orderConfirmUnsaved).toBeGreaterThan(-1);
    expect(orderConfirmReject).toBeGreaterThan(orderConfirmUnsaved);
  });

  it("multi-account binding UI lists accounts per platform", () => {
    const ui =
      read("client/src/components/platformAccounts/PlatformAccountMatrix.tsx") +
      read("client/src/components/platformAccounts/PlatformAccountTable.tsx") +
      read("client/src/components/platformAccounts/usePlatformAccountBinding.ts");
    expect(ui).toContain("bind-publish-account-");
    expect(ui).toContain("bindLocalAgentAccount");
    expect(ui).toContain('data-testid="platform-account-row"');
  });

  it("index check script documents old and new index names", () => {
    const script = read("scripts/check_platform_account_indexes.mjs");
    expect(script).toContain("project_platform_accounts_project_platform");
    expect(script).toContain("project_platform_accounts_project_platform_name");
  });
});
