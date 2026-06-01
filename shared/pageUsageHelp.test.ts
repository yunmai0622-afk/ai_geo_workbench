import { describe, expect, it } from "vitest";
import { PAGE_USAGE_HELP, resolvePageUsageHelpId } from "./pageUsageHelp";

describe("resolvePageUsageHelpId", () => {
  it("maps main GEO pages", () => {
    expect(resolvePageUsageHelpId("/workspace")).toBe("workspace");
    expect(resolvePageUsageHelpId("/ai-diagnosis")).toBe("ai-diagnosis");
    expect(resolvePageUsageHelpId("/weekly")).toBe("content-generation");
    expect(resolvePageUsageHelpId("/content-publishing")).toBe("content-publishing");
    expect(resolvePageUsageHelpId("/inclusion-monitoring")).toBe("inclusion-monitoring");
  });

  it("returns null for unrelated paths", () => {
    expect(resolvePageUsageHelpId("/clients")).toBeNull();
    expect(resolvePageUsageHelpId("/enterprise-profile")).toBeNull();
  });
});

describe("PAGE_USAGE_HELP", () => {
  it("defines all five main pages", () => {
    expect(Object.keys(PAGE_USAGE_HELP).sort()).toEqual(
      [
        "ai-diagnosis",
        "content-generation",
        "content-publishing",
        "inclusion-monitoring",
        "workspace",
      ].sort(),
    );
  });
});
