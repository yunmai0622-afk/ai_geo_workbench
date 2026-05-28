import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPlatformContentStrategyMeta, buildDefaultPlatformStrategy } from "@shared/platformContentRules";
import { evaluatePublishReadiness } from "@shared/publishReadiness";
import { isBlockedZhihuDisplayName } from "@shared/zhihuNicknameDenylist";
import {
  getZhihuNicknameRejectionReason,
  parseZhihuDocumentTitle,
  resolveZhihuIdentityFromSignals,
} from "../local-agent/src/agent/zhihuIdentityResolver";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

const PROFILE_URL = "https://www.zhihu.com/people/meng-ke-ke-61";

const baseContext = {
  projectAccessible: true,
  enterpriseProfileReady: true,
  diagnosisReady: true,
  localAgentConnected: true,
  skipLocalAgentConnectionCheck: false,
};

function zhihuArticle() {
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
  };
}

function validSignals(
  partial: Partial<Parameters<typeof resolveZhihuIdentityFromSignals>[0]> = {},
) {
  return {
    pageUrl: PROFILE_URL,
    documentTitle: "蒙科恰 - 知乎",
    loginStatus: "valid" as const,
    profileHeaderTitle: null,
    viewerStateName: null,
    viewerStateSlug: null,
    userMenuName: null,
    ...partial,
  };
}

describe("zhihuIdentityResolver trusted sources", () => {
  it("profile header 蒙科恰 → verified profile_header", () => {
    const r = resolveZhihuIdentityFromSignals(
      validSignals({ profileHeaderTitle: "蒙科恰" }),
    );
    expect(r.displayName).toBe("蒙科恰");
    expect(r.displayNameVerified).toBe(true);
    expect(r.displayNameSource).toBe("profile_header");
  });

  it("document.title alone on profile page is not used", () => {
    const r = resolveZhihuIdentityFromSignals(validSignals());
    expect(r.displayName).toBeNull();
  });

  it("misleading document.title on profile page is ignored without header", () => {
    const r = resolveZhihuIdentityFromSignals(
      validSignals({ documentTitle: "Azul - 知乎", profileHeaderTitle: null }),
    );
    expect(r.displayName).toBeNull();
  });

  it("viewer state 蒙科恰 → verified viewer_state when urlToken matches slug", () => {
    const r = resolveZhihuIdentityFromSignals(
      validSignals({
        documentTitle: "知乎",
        profileHeaderTitle: null,
        viewerStateName: "蒙科恰",
        viewerStateSlug: "meng-ke-ke-61",
      }),
    );
    expect(r.displayName).toBe("蒙科恰");
    expect(r.displayNameSource).toBe("viewer_state");
  });

  it("viewer state is ignored when urlToken does not match profile slug", () => {
    const r = resolveZhihuIdentityFromSignals(
      validSignals({
        profileHeaderTitle: null,
        viewerStateName: "蒙科恰",
        viewerStateSlug: "other-user",
      }),
    );
    expect(r.displayName).toBeNull();
  });

  it("user menu is not used as nickname source", () => {
    const r = resolveZhihuIdentityFromSignals(
      validSignals({
        documentTitle: "知乎",
        userMenuName: "蒙科恰",
        profileHeaderTitle: null,
      }),
    );
    expect(r.displayName).toBeNull();
  });

  it("non-profile page uses viewer_state only when slug matches", () => {
    const r = resolveZhihuIdentityFromSignals({
      pageUrl: "https://www.zhihu.com/",
      documentTitle: "某文章 - 知乎",
      loginStatus: "valid",
      profileHeaderTitle: null,
      viewerStateName: "蒙科恰",
      viewerStateSlug: "meng-ke-ke-61",
      userMenuName: "Azul",
    });
    expect(r.displayName).toBe("蒙科恰");
    expect(r.displayNameSource).toBe("viewer_state");
  });

  it.each(["专栏0", "回答3", "文章5", "广告", "博丽灵梦"])(
    "rejects fake nickname %s",
    value => {
      expect(getZhihuNicknameRejectionReason(value, "candidate")).not.toBeNull();
      expect(isBlockedZhihuDisplayName(value)).toBe(true);
    },
  );

  it("rejects nav 专栏 and button 编辑个人资料", () => {
    expect(getZhihuNicknameRejectionReason("专栏", "candidate")).not.toBeNull();
    expect(getZhihuNicknameRejectionReason("编辑个人资料", "candidate")).not.toBeNull();
  });

  it("document.title 专栏 - 知乎 is not used for nickname", () => {
    expect(parseZhihuDocumentTitle("专栏 - 知乎")).toBe("专栏");
    const r = resolveZhihuIdentityFromSignals(
      validSignals({ documentTitle: "专栏 - 知乎", profileHeaderTitle: null, viewerStateName: null }),
    );
    expect(r.displayName).toBeNull();
  });

  it.each(["专栏0", "专栏 0", "回答 3"])("rejects tab label with optional space %s", value => {
    expect(getZhihuNicknameRejectionReason(value, "candidate")).not.toBeNull();
  });

  it("valid login + no trusted nickname → displayName null, verified false", () => {
    const r = resolveZhihuIdentityFromSignals({
      pageUrl: "https://www.zhihu.com/",
      documentTitle: "知乎",
      loginStatus: "valid",
      profileHeaderTitle: null,
      viewerStateName: null,
      viewerStateSlug: null,
      userMenuName: null,
    });
    expect(r.displayName).toBeNull();
    expect(r.displayNameVerified).toBe(false);
    expect(r.loginStatus).toBe("valid");
  });

  it("invalid login status preserved", () => {
    const r = resolveZhihuIdentityFromSignals({
      ...validSignals(),
      loginStatus: "invalid",
    });
    expect(r.loginStatus).toBe("invalid");
  });
});

describe("zhihuIdentityResolver meng-ke-ke-61 fixture", () => {
  it("extracts 蒙科恰 and rejects tab stats from fixture HTML", () => {
    const html = read("local-agent/fixtures/zhihu-profile-meng-ke-ke-61.html");
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1]?.trim() ?? "";
    const h1 = html.match(/<h1>([^<]+)<\/h1>/)?.[1]?.trim() ?? "";
    expect(title).toBe("蒙科恰 - 知乎");
    expect(h1).toBe("蒙科恰");

    const identity = resolveZhihuIdentityFromSignals(
      validSignals({ profileHeaderTitle: h1, documentTitle: title }),
    );
    expect(identity.displayName).toBe("蒙科恰");
    expect(identity.profileSlug).toBe("meng-ke-ke-61");

    for (const bad of ["专栏0", "回答3", "文章5", "广告"]) {
      expect(identity.displayName).not.toBe(bad);
      expect(getZhihuNicknameRejectionReason(bad, "candidate")).not.toBeNull();
    }
  });

  it("fixture HTML contains profile slug and real nickname markers", () => {
    const html = read("local-agent/fixtures/zhihu-profile-meng-ke-ke-61.html");
    expect(html).toContain("meng-ke-ke-61");
    expect(html).toContain("蒙科恰");
    expect(html).toContain("专栏 0");
  });
});

describe("zhihuIdentityResolver publish gate wiring", () => {
  it("valid + displayName null → publishReadiness ready", () => {
    const r = evaluatePublishReadiness({
      ...baseContext,
      article: zhihuArticle(),
      platformAccounts: [],
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
    });
    expect(r.ready).toBe(true);
    expect(r.blockingCode).toBeNull();
  });

  it("invalid snapshot → blocked", () => {
    const r = evaluatePublishReadiness({
      ...baseContext,
      article: zhihuArticle(),
      platformAccounts: [],
      localAgentAccountSnapshot: [
        {
          platform: "zhihu",
          profileId: "zhihu_1",
          displayName: null,
          displayNameVerified: false,
          loginStatus: "invalid",
          lastCheckedAt: new Date().toISOString(),
        },
      ],
    });
    expect(r.ready).toBe(false);
  });

  it("publishTasks.create does not block on nickname mismatch alone", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("evaluatePublishReadiness");
    expect(router).not.toMatch(/昵称不一致.*blockingCode/);
  });

  it("zhihuPublisher no longer scans all buttons/titles as nickname candidates", () => {
    const src = read("local-agent/src/agent/platforms/zhihuPublisher.ts");
    expect(src).toContain("resolveZhihuIdentity");
    expect(src).toContain("collectZhihuIdentitySignalsInBrowser");
    expect(src).toContain("collectLoginProfileSlugInBrowser");
    expect(src).toContain("waitForStableProfileHeaderH1");
    expect(src).not.toContain('querySelectorAll("button, [role=\'button\']")');
    expect(src).not.toContain('querySelectorAll("[title], [aria-label]")');
  });

  it("sync payload excludes cookie/password/profilePath", () => {
    const sharedSync = read("shared/localAgentAccountSync.ts");
    expect(sharedSync).not.toMatch(/cookie|password|profilePath/i);
  });

  it("WeeklyContentPage re-detect can sync to web", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("hydratePublishDialogAgent({ syncToWeb: true })");
    expect(weekly).toContain("publish-dialog-nickname-pending-hint");
  });
});
