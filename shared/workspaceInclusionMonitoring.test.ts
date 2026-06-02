import { describe, expect, it } from "vitest";
import {
  buildWorkspaceInclusionPlatformRows,
  formatInclusionCheckedAtLabel,
  workspaceInclusionEmptyGuide,
} from "./workspaceInclusionMonitoring";

describe("workspaceInclusionMonitoring", () => {
  it("aggregates by publish platform and picks latest check time", () => {
    const rows = buildWorkspaceInclusionPlatformRows(
      [
        {
          id: 1,
          publishRecordId: 10,
          inclusionStatus: "未收录",
          lastCheckedAt: "2026-05-01T08:00:00.000Z",
        },
        {
          id: 2,
          publishRecordId: 11,
          inclusionStatus: "已收录",
          lastCheckedAt: "2026-05-10T08:00:00.000Z",
        },
        {
          id: 3,
          publishRecordId: 12,
          inclusionStatus: "已收录",
          lastCheckedAt: "2026-05-12T08:00:00.000Z",
        },
      ],
      [
        { id: 10, publishChannel: "知乎" },
        { id: 11, publishChannel: "知乎" },
        { id: 12, publishChannel: "百家号" },
      ],
    );

    expect(rows).toHaveLength(2);
    const zhihu = rows.find(r => r.platform === "知乎");
    expect(zhihu?.inclusionStatus).toBe("已收录");
    expect(zhihu?.recordCount).toBe(2);
    expect(rows[0]?.platform).toBe("百家号");
  });

  it("formatInclusionCheckedAtLabel returns 未检测 when missing", () => {
    expect(formatInclusionCheckedAtLabel(null)).toBe("未检测");
  });

  it("workspaceInclusionEmptyGuide branches on publish vs monitoring", () => {
    expect(workspaceInclusionEmptyGuide({ monitoringCount: 0, publishRecordCount: 2 }).ctaLabel).toBe(
      "进入收录监测",
    );
    expect(workspaceInclusionEmptyGuide({ monitoringCount: 0, publishRecordCount: 0 }).ctaLabel).toBe(
      "前往内容发布",
    );
  });
});
