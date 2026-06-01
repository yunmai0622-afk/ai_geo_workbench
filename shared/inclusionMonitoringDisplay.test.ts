import { describe, expect, it } from "vitest";
import {
  buildMonitoringNextAction,
  monitorStatusLabelCn,
  parsePublishLinkAccess,
  publishLinkAccessLabel,
} from "./inclusionMonitoringDisplay";

describe("inclusionMonitoringDisplay", () => {
  it("maps English monitor statuses to Chinese labels", () => {
    expect(monitorStatusLabelCn("unchecked")).toBe("未检测");
    expect(monitorStatusLabelCn("checking")).toBe("检测中");
    expect(monitorStatusLabelCn("included")).toBe("已收录");
    expect(monitorStatusLabelCn("not_included")).toBe("未收录");
    expect(monitorStatusLabelCn("ai_tested")).toBe("AI已实测");
    expect(monitorStatusLabelCn("mentioned")).toBe("已提及");
    expect(monitorStatusLabelCn("not_recommended")).toBe("未推荐");
  });

  it("builds next action suggestions by monitoring state", () => {
    expect(buildMonitoringNextAction({ inclusionStatus: "unchecked" })).toBe("执行AI实测");
    expect(buildMonitoringNextAction({ inclusionStatus: "included" })).toBe("执行AI实测");
    expect(
      buildMonitoringNextAction({
        inclusionStatus: "included",
        lastAiTestedAt: "2026-06-01T00:00:00.000Z",
      }),
    ).toBe("查看实测结果");
  });

  it("parses publish link accessibility from rawJson", () => {
    const snapshot = parsePublishLinkAccess({
      linkAccess: { accessible: true, checkedAt: "2026-06-01T08:00:00.000Z", statusCode: 200 },
    });
    expect(snapshot?.accessible).toBe(true);
    expect(publishLinkAccessLabel(snapshot)).toBe("可公开访问");
    expect(publishLinkAccessLabel(null)).toBe("未检测");
    expect(
      publishLinkAccessLabel({
        accessible: false,
        checkedAt: "2026-06-01T08:00:00.000Z",
      }),
    ).toBe("不可访问");
  });
});
