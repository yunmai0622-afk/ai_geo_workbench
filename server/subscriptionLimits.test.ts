import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  BASIC_PLAN_LIMITS,
  SUBSCRIPTION_LIMIT_CONTENT_MESSAGE,
  SUBSCRIPTION_LIMIT_PROJECT_MESSAGE,
  SUBSCRIPTION_UPGRADE_PATH,
  isSubscriptionLimitMessage,
} from "../shared/subscriptionLimits";

const root = path.resolve(import.meta.dirname, "..");

describe("GEO-V1.1-Pricing-Logic subscription limits", () => {
  it("defines basic plan quotas", () => {
    expect(BASIC_PLAN_LIMITS.maxProjects).toBe(1);
    expect(BASIC_PLAN_LIMITS.maxContentArticles).toBe(10);
  });

  it("upgrade path points to pricing page", () => {
    expect(SUBSCRIPTION_UPGRADE_PATH).toBe("/pricing");
  });

  it("recognizes subscription limit user messages", () => {
    expect(isSubscriptionLimitMessage(SUBSCRIPTION_LIMIT_PROJECT_MESSAGE)).toBe(true);
    expect(isSubscriptionLimitMessage(SUBSCRIPTION_LIMIT_CONTENT_MESSAGE)).toBe(true);
    expect(isSubscriptionLimitMessage("其它错误")).toBe(false);
  });

  it("enforces limits in geo routers", () => {
    const routers = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
    expect(routers).toContain("assertCanCreateProject");
    expect(routers).toContain("assertCanGenerateContent");
    expect(routers).toContain('from "./subscriptionLimits"');
    expect(routers).toContain("getSubscriptionUsageSnapshot");
  });

  it("client surfaces upgrade prompt to pricing", () => {
    const prompt = fs.readFileSync(path.join(root, "client/src/components/SubscriptionUpgradePrompt.tsx"), "utf8");
    expect(prompt).toContain("SUBSCRIPTION_UPGRADE_PATH");
    const helper = fs.readFileSync(path.join(root, "client/src/lib/subscriptionUpgrade.ts"), "utf8");
    expect(helper).toContain("SUBSCRIPTION_UPGRADE_PATH");
  });
});
