import { describe, expect, it } from "vitest";
import { buildDefaultPlatformStrategy, buildPlatformContentStrategyMeta } from "./platformContentRules";
import { articleHasPublishableCover } from "./articleCoverReadiness";
import { getUnifiedQualityGateStatus } from "./contentQualityGate";
import { evaluatePublishPreflight, inferServerHeartbeatConnected } from "./publishPreflight";

const projectId = 90001;

function zhihuArticle(overrides: Record<string, unknown> = {}) {
  const strategy = buildDefaultPlatformStrategy({
    targetPublishPlatform: "zhihu",
    targetQuestion: "如何选型？",
  });
  return {
    id: 1,
    projectId,
    title: "知识付费平台怎么选",
    markdownContent: "字".repeat(2000),
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

const connectedAgent = {
  serverHeartbeatConnected: true,
  browserLocalAgentConnected: true,
  localAgentAccountSnapshot: [] as const,
};

describe("articleHasPublishableCover", () => {
  it("passes when coverImageUrl exists", () => {
    expect(articleHasPublishableCover({ coverImageUrl: "https://cdn.example.com/c.png" })).toBe(true);
  });

  it("passes when retainedCoverUrl / manualCoverUrl exist", () => {
    expect(articleHasPublishableCover({ retainedCoverUrl: "https://cdn.example.com/r.png" })).toBe(true);
    expect(articleHasPublishableCover({ manualCoverUrl: "https://cdn.example.com/m.png" })).toBe(true);
  });
});

describe("getUnifiedQualityGateStatus", () => {
  it("passes when qualityStatus=passed", () => {
    expect(getUnifiedQualityGateStatus({ qualityStatus: "passed" }).passed).toBe(true);
  });

  it("passes when qualityPasses=true", () => {
    expect(getUnifiedQualityGateStatus({ qualityPasses: true }).passed).toBe(true);
  });
});

describe("evaluatePublishPreflight", () => {
  it("projectId=90001: cover + account valid + quality passed → ready", () => {
    const result = evaluatePublishPreflight({
      projectId,
      article: zhihuArticle({ coverImageUrl: "https://cdn.example.com/cover.png" }),
      platformAccounts: [zhihuReadyAccount],
      localAgentStatus: connectedAgent,
      selectedAccount: zhihuReadyAccount,
    });
    expect(result.ready).toBe(true);
    expect(result.canCreatePublishTask).toBe(true);
    expect(result.checks.find(c => c.code === "COVER_READY")?.status).toBe("pass");
    expect(result.checks.find(c => c.code === "QUALITY_PASSED")?.status).toBe("pass");
    expect(result.checks.find(c => c.code === "PLATFORM_ACCOUNT_VALID")?.status).not.toBe("fail");
  });

  it("zhihu without cover does not block COVER_READY", () => {
    const result = evaluatePublishPreflight({
      projectId,
      article: zhihuArticle(),
      platformAccounts: [zhihuReadyAccount],
      localAgentStatus: connectedAgent,
      selectedAccount: zhihuReadyAccount,
    });
    expect(result.checks.find(c => c.code === "COVER_READY")?.status).toBe("pass");
    expect(result.ready).toBe(true);
  });

  it("localAgentAccountSnapshot zhihu valid passes PLATFORM_ACCOUNT_VALID", () => {
    const result = evaluatePublishPreflight({
      projectId,
      article: zhihuArticle(),
      platformAccounts: [],
      localAgentStatus: {
        ...connectedAgent,
        localAgentAccountSnapshot: [
          {
            platform: "zhihu",
            profileId: "zhihu_1",
            displayName: null,
            displayNameVerified: false,
            loginStatus: "valid",
            lastCheckedAt: new Date().toISOString(),
          },
        ],
      },
    });
    const accountCheck = result.checks.find(c => c.code === "PLATFORM_ACCOUNT_VALID");
    expect(accountCheck?.status).not.toBe("fail");
    expect(result.ready).toBe(true);
  });

  it("nickname pending does not block publish", () => {
    const result = evaluatePublishPreflight({
      projectId,
      article: zhihuArticle(),
      platformAccounts: [],
      localAgentStatus: {
        ...connectedAgent,
        localAgentAccountSnapshot: [
          {
            platform: "zhihu",
            profileId: "zhihu_1",
            displayName: "昵称待识别",
            displayNameVerified: false,
            loginStatus: "valid",
            lastCheckedAt: new Date().toISOString(),
          },
        ],
      },
    });
    expect(result.ready).toBe(true);
  });

  it("rejects cross-project article", () => {
    const result = evaluatePublishPreflight({
      projectId,
      article: zhihuArticle({ projectId: 90002 }),
      platformAccounts: [zhihuReadyAccount],
      localAgentStatus: connectedAgent,
    });
    expect(result.ready).toBe(false);
    expect(result.blockingCodes).toContain("ARTICLE_BELONGS_TO_PROJECT");
  });

  it("requestedPlatform covers legacy article without platform", () => {
    const result = evaluatePublishPreflight({
      projectId,
      article: { id: 2, projectId, title: "标题", markdownContent: "字".repeat(2000), generationBasis: {} },
      requestedPlatform: "zhihu",
      platformAccounts: [zhihuReadyAccount],
      localAgentStatus: connectedAgent,
      selectedAccount: zhihuReadyAccount,
    });
    expect(result.blockingCodes).not.toContain("ARTICLE_PLATFORM_MATCH");
    expect(result.selectedPlatform).toBe("zhihu");
  });

  it("server heartbeat without browser blocks LOCAL_AGENT_CONNECTED only", () => {
    const result = evaluatePublishPreflight({
      projectId,
      article: zhihuArticle({ coverImageUrl: "https://x.test/c.png" }),
      platformAccounts: [zhihuReadyAccount],
      localAgentStatus: {
        serverHeartbeatConnected: true,
        browserLocalAgentConnected: false,
        localAgentAccountSnapshot: [],
      },
      selectedAccount: zhihuReadyAccount,
    });
    expect(result.blockingCodes).toContain("LOCAL_AGENT_CONNECTED");
    expect(result.blockingCodes).not.toContain("COVER_READY");
    expect(result.blockingCodes).not.toContain("QUALITY_PASSED");
  });

  it("inferServerHeartbeatConnected from active DB accounts", () => {
    expect(inferServerHeartbeatConnected([zhihuReadyAccount])).toBe(true);
    expect(inferServerHeartbeatConnected([])).toBe(false);
  });
});
