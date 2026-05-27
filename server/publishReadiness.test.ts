import { describe, expect, it } from "vitest";
import { buildPlatformContentStrategyMeta, buildDefaultPlatformStrategy } from "@shared/platformContentRules";
import {
  evaluatePublishReadiness,
  isPublishReadyPlatformAccount,
  publishReadinessRiskHint,
} from "@shared/publishReadiness";

const baseContext = {
  projectAccessible: true,
  enterpriseProfileReady: true,
  diagnosisReady: true,
  localAgentConnected: true,
  skipLocalAgentConnectionCheck: false,
};

function zhihuArticle(overrides: Record<string, unknown> = {}) {
  const strategy = buildDefaultPlatformStrategy({
    targetPublishPlatform: "zhihu",
    targetQuestion: "如何选型？",
  });
  return {
    id: 1,
    generationBasis: {
      platformContentStrategy: buildPlatformContentStrategyMeta(strategy) as unknown as Record<string, unknown>,
    },
    lifecycleStatus: "quality_checked",
    geoQualityScore: 85,
    geoQualityRecommendation: "publish",
    ...overrides,
  };
}

const zhihuReadyAccount = {
  platform: "zhihu",
  accountName: "测试号",
  isEnabled: true,
  localProfileId: "p1",
  localAgentId: "agent-1",
  sessionStatus: "active",
};

describe("publishReadiness evaluatePublishReadiness", () => {
  it("zhihu + quality pass + agent + account bound → ready", () => {
    const r = evaluatePublishReadiness({
      ...baseContext,
      article: zhihuArticle(),
      platformAccounts: [zhihuReadyAccount],
    });
    expect(r.ready).toBe(true);
    expect(r.blockingCode).toBeNull();
    expect(r.nextActionTarget).toBe("create_publish_task");
  });

  it("zhihu + quality pass + agent + account unbound → PLATFORM_ACCOUNT_UNBOUND", () => {
    const r = evaluatePublishReadiness({
      ...baseContext,
      article: zhihuArticle(),
      platformAccounts: [],
    });
    expect(r.ready).toBe(false);
    expect(r.blockingCode).toBe("PLATFORM_ACCOUNT_UNBOUND");
    expect(r.message).toMatch(/知乎/);
    expect(r.nextActionTarget).toBe("open_local_agent_accounts");
  });

  it("unknown platform → PLATFORM_UNKNOWN", () => {
    const r = evaluatePublishReadiness({
      ...baseContext,
      article: { id: 2, generationBasis: {} },
      platformAccounts: [zhihuReadyAccount],
    });
    expect(r.blockingCode).toBe("PLATFORM_UNKNOWN");
    expect(r.message).toMatch(/暂未识别本篇发布平台/);
  });

  it("xiaohongshu → PLATFORM_UNSUPPORTED", () => {
    const r = evaluatePublishReadiness({
      ...baseContext,
      article: {
        generationBasis: {
          platformContentStrategy: {
            targetPublishPlatform: "xiaohongshu",
            targetPublishPlatformLabel: "小红书",
          },
        },
      },
      platformAccounts: [],
    });
    expect(r.blockingCode).toBe("PLATFORM_UNSUPPORTED");
    expect(r.message).toMatch(/小红书/);
  });

  it("lifecycle quality_checked without geo fields → ready quality path", () => {
    const r = evaluatePublishReadiness({
      ...baseContext,
      article: zhihuArticle({
        geoQualityScore: null,
        geoQualityRecommendation: null,
        lifecycleStatus: "quality_checked",
      }),
      platformAccounts: [zhihuReadyAccount],
    });
    expect(r.ready).toBe(true);
  });

  it("quality failed → QUALITY_FAILED", () => {
    const r = evaluatePublishReadiness({
      ...baseContext,
      article: zhihuArticle({
        geoQualityRecommendation: "reject",
        geoQualityScore: 40,
      }),
      platformAccounts: [zhihuReadyAccount],
    });
    expect(r.blockingCode).toBe("QUALITY_FAILED");
  });

  it("quality stale → QUALITY_STALE", () => {
    const r = evaluatePublishReadiness({
      ...baseContext,
      article: zhihuArticle({ geoQualityStale: true }),
      platformAccounts: [zhihuReadyAccount],
    });
    expect(r.blockingCode).toBe("QUALITY_STALE");
    expect(r.message).toMatch(/重新质检/);
  });

  it("project inaccessible → PROJECT_INACCESSIBLE", () => {
    const r = evaluatePublishReadiness({
      ...baseContext,
      projectAccessible: false,
      article: zhihuArticle(),
    });
    expect(r.blockingCode).toBe("PROJECT_INACCESSIBLE");
  });

  it("profile incomplete → PROFILE_INCOMPLETE", () => {
    const r = evaluatePublishReadiness({
      ...baseContext,
      enterpriseProfileReady: false,
      article: zhihuArticle(),
    });
    expect(r.blockingCode).toBe("PROFILE_INCOMPLETE");
    expect(r.message).not.toMatch(/GEO 建档 P0 必填未完成/);
  });

  it("diagnosis required → DIAGNOSIS_REQUIRED", () => {
    const r = evaluatePublishReadiness({
      ...baseContext,
      diagnosisReady: false,
      article: zhihuArticle(),
    });
    expect(r.blockingCode).toBe("DIAGNOSIS_REQUIRED");
  });

  it("local agent disconnected → LOCAL_AGENT_DISCONNECTED", () => {
    const r = evaluatePublishReadiness({
      ...baseContext,
      localAgentConnected: false,
      article: zhihuArticle(),
      platformAccounts: [zhihuReadyAccount],
    });
    expect(r.blockingCode).toBe("LOCAL_AGENT_DISCONNECTED");
  });

  it("risk hint matches blocking message for unbound account", () => {
    const r = evaluatePublishReadiness({
      ...baseContext,
      article: zhihuArticle(),
      platformAccounts: [],
    });
    expect(publishReadinessRiskHint(r)).toBe(r.message);
    expect(r.blockingCode).toBe("PLATFORM_ACCOUNT_UNBOUND");
  });

  it("isPublishReadyPlatformAccount requires active session", () => {
    expect(isPublishReadyPlatformAccount(zhihuReadyAccount)).toBe(true);
    expect(
      isPublishReadyPlatformAccount({ ...zhihuReadyAccount, sessionStatus: "expired" }),
    ).toBe(false);
  });

  it("server skip local agent still checks account", () => {
    const r = evaluatePublishReadiness({
      ...baseContext,
      localAgentConnected: false,
      skipLocalAgentConnectionCheck: true,
      article: zhihuArticle(),
      platformAccounts: [zhihuReadyAccount],
    });
    expect(r.ready).toBe(true);
  });
});

describe("publishReadiness static wiring", () => {
  it("publishTasksRouter references evaluatePublishReadiness", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const router = fs.readFileSync(path.join(process.cwd(), "server/publishTasksRouter.ts"), "utf-8");
    expect(router).toContain("evaluatePublishReadiness");
  });

  it("WeeklyContentPage references evaluatePublishReadiness", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const page = fs.readFileSync(path.join(process.cwd(), "client/src/pages/WeeklyContentPage.tsx"), "utf-8");
    expect(page).toContain("evaluatePublishReadiness");
    expect(page).not.toMatch(/在 Web 绑定.*Cookie/i);
  });
});
