import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_SUBSCRIPTION_PLAN_ID,
  SUBSCRIPTION_PLANS,
  getSubscriptionPlanById,
  resolveUserSubscriptionPlanId,
} from "../shared/subscriptionPlans";

const root = path.resolve(import.meta.dirname, "..");

describe("GEO-V1.1 subscription plans display", () => {
  it("defines three public plans", () => {
    expect(SUBSCRIPTION_PLANS).toHaveLength(3);
    expect(SUBSCRIPTION_PLANS.map(p => p.id)).toEqual(["basic", "professional", "enterprise"]);
    expect(SUBSCRIPTION_PLANS[0]?.priceLabel).toBe("免费");
    expect(SUBSCRIPTION_PLANS[1]?.priceLabel).toContain("299");
    expect(SUBSCRIPTION_PLANS[2]?.priceLabel).toBe("联系我们");
  });

  it("defaults users to basic plan before billing", () => {
    expect(resolveUserSubscriptionPlanId()).toBe(DEFAULT_SUBSCRIPTION_PLAN_ID);
    expect(getSubscriptionPlanById("basic").name).toBe("基础版");
  });

  it("pricing page route exists", () => {
    const app = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
    expect(app).toContain('path="/pricing"');
    expect(fs.existsSync(path.join(root, "client/src/pages/PricingPage.tsx"))).toBe(true);
  });

  it("settings page shows current plan from subscription usage", () => {
    const settings = fs.readFileSync(path.join(root, "client/src/pages/SettingsPage.tsx"), "utf8");
    expect(settings).toContain("settings-subscription-plan");
    expect(settings).toContain("当前套餐");
    expect(settings).toContain("geo.subscription.usage");
  });

  it("basic plan trial limits are enforced server-side", () => {
    const limits = fs.readFileSync(path.join(root, "shared/subscriptionLimits.ts"), "utf8");
    expect(limits).toContain("maxProjects: 1");
    expect(limits).toContain("maxT0Detections: 3");
    expect(limits).toContain("maxContentArticles: 10");
    const svc = fs.readFileSync(path.join(root, "server/subscriptionLimits.ts"), "utf8");
    expect(svc).toContain("assertCanCreateProject");
    expect(svc).toContain("assertCanRunT0Detection");
    expect(svc).toContain("assertCanGenerateContent");
  });
});
