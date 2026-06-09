import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
import { evaluateOnboardingWizardCompleteness } from "@shared/onboardingWizardCompleteness";
import { mergeGeoGoalNotesPayload, parseGeoGoalNotesPayload } from "@shared/onboardingWizardGeoGoalNotes";

describe("onboarding wizard completeness", () => {
  it("computes 8-dimension weighted completion score", () => {
    const result = evaluateOnboardingWizardCompleteness({
      profile: {
        brandName: "海豚知道",
        enterpriseName: "海豚知道科技",
        oneLiner: "知识付费 SaaS",
        officialWebsite: "https://example.com",
        region: "北京",
        industryTag: "教育",
        productDesc: "课程交付系统",
        keyPoints: ["交付快"],
        keywords: ["知识付费"],
        targetCustomer: "培训机构",
        customerPains: ["获客难"],
        competitors: ["小鹅通"],
        targetMentionRate: 30,
        targetRecommendationRate: 20,
        targetPlatforms: ["豆包"],
        internalOwnerName: "张三",
        geoGoalNotes: JSON.stringify({ goalNotes: "90天提升推荐率" }),
      },
      questionCount: 15,
      customerCaseCount: 2,
      brandSourceCount: 5,
      brandSourcePlatformCount: 3,
    });
    expect(result.brandIdentityScore).toBeGreaterThan(0);
    expect(result.competitorScore).toBe(100);
    expect(result.completionScore).toBeGreaterThan(0);
    expect(result.completionScore).toBeLessThanOrEqual(100);
  });
});

describe("geoGoalNotes payload", () => {
  it("round-trips question guide and goal notes", () => {
    const raw = mergeGeoGoalNotesPayload(null, {
      goalNotes: "提升推荐",
      questionGuide: {
        brandSearch: ["海豚知道怎么样"],
        categoryRecommend: [],
        sceneNeed: [],
        comparison: [],
        longTail: [],
      },
    });
    const parsed = parseGeoGoalNotesPayload(raw);
    expect(parsed.goalNotes).toBe("提升推荐");
    expect(parsed.questionGuide?.brandSearch).toContain("海豚知道怎么样");
  });
});

describe("onboarding wizard static wiring", () => {
  it("AssetCenter uses 8-step wizard shell", () => {
    const page = readFileSync(resolve(root, "client/src/pages/AssetCenter.tsx"), "utf-8");
    expect(page).toContain("OnboardingWizardShell");
    expect(page).toContain("ONBOARDING_WIZARD_PAGE_TITLE");
    expect(readFileSync(resolve(root, "client/src/components/enterpriseProfile/wizard/OnboardingWizardShell.tsx"), "utf-8")).toContain(
      "wizard-step-nav",
    );
  });
});
