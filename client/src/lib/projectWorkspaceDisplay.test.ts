import { describe, expect, it } from "vitest";
import { formatClientProjectMentionRate } from "./projectWorkspaceDisplay";

describe("formatClientProjectMentionRate", () => {
  it("shows percent when mention rate is available", () => {
    expect(formatClientProjectMentionRate({ mentionRate: 0.38, hasAiTestData: true })).toBe("38%");
  });

  it("shows 0% when measured rate is zero", () => {
    expect(formatClientProjectMentionRate({ mentionRate: 0, hasAiTestData: true })).toBe("0%");
  });

  it("shows 未实测 when no diagnosis data", () => {
    expect(formatClientProjectMentionRate({ mentionRate: null, hasAiTestData: false })).toBe("未实测");
  });

  it("shows 加载中 while fetching", () => {
    expect(
      formatClientProjectMentionRate({ mentionRate: null, hasAiTestData: false, loading: true }),
    ).toBe("加载中");
  });

  it("does not return placeholder dashes", () => {
    const text = formatClientProjectMentionRate({ mentionRate: null, hasAiTestData: false });
    expect(text).not.toBe("--");
  });
});
