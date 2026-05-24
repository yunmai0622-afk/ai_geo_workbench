import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { accountGroupsMismatch, formatArticleStrategySummary } from "@shared/contentStrategy";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("P1-B content strategy", () => {
  it("project platform account supports accountGroup and accountRole", () => {
    expect(read("drizzle/schema.ts")).toContain("accountGroup");
    expect(read("server/projectPlatformAccounts.ts")).toContain("accountGroup:");
    expect(read("client/src/components/PlatformAccountBindingSection.tsx")).toContain("所属账号组");
  });

  it("updateGeneratedArticle saves contentStrategyType / publishIdentity / recommendedAccountGroup", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("contentStrategyType: z.enum(CONTENT_ASSET_TYPES)");
    expect(router).toContain("recommendedAccountGroup: z.enum(ACCOUNT_GROUP_TYPES)");
  });

  it("article card renders strategy labels", () => {
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("formatArticleStrategySummary");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("article-strategy-summary");
  });

  it("account group mismatch shows warning", () => {
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("account-group-mismatch-hint");
    expect(read("client/src/pages/WeeklyContentPage.tsx")).toContain("ACCOUNT_GROUP_MISMATCH_HINT");
  });

  it("account group mismatch does not block publish", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    const mismatchIdx = weekly.indexOf("account-group-mismatch-hint");
    const blockIdx = weekly.indexOf("blockPublishIfUnsaved(publishArticle.id)");
    expect(mismatchIdx).toBeGreaterThan(-1);
    expect(blockIdx).toBeGreaterThan(-1);
    expect(weekly.indexOf("return;", blockIdx)).toBeLessThan(mismatchIdx);
  });

  it("unsaved changes still block before account group warning", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    const openFn = weekly.slice(weekly.indexOf("const openPublishDialog"));
    expect(openFn.indexOf("blockPublishIfUnsaved(article.id)")).toBeLessThan(
      openFn.indexOf("setPublishDialogOpen(true)"),
    );
  });

  it("reject quality still blocks before account group warning", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    const openFn = weekly.slice(weekly.indexOf("const openPublishDialog"));
    expect(openFn.indexOf("blockPublishIfQualityReject(article)")).toBeLessThan(
      openFn.indexOf("setPublishDialogOpen(true)"),
    );
  });

  it("formatArticleStrategySummary for card", () => {
    expect(
      formatArticleStrategySummary({
        contentStrategyType: "seeding",
        publishIdentity: "employee",
        recommendedAccountGroup: "employee_group",
      }),
    ).toContain("种草推荐型");
    expect(accountGroupsMismatch("official_group", "seeding_group")).toBe(true);
  });
});
