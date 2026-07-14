import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  dueSampleMilestoneKeys,
  SAMPLE_RETEST_MILESTONES,
  SAMPLE_RETEST_PROJECT_ID,
  SAMPLE_RETEST_QUESTIONS,
} from "./scheduledSampleRetest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.3 scheduled sample retest", () => {
  it("is hard-scoped to project 210001 and the four approved questions", () => {
    expect(SAMPLE_RETEST_PROJECT_ID).toBe(210001);
    expect(SAMPLE_RETEST_QUESTIONS).toEqual([
      "海豚知道是什么？",
      "海豚知道主要解决什么问题？",
      "知识付费 SaaS 系统有哪些推荐？",
      "知识付费团队如何做系统化经营？",
    ]);
  });

  it("only exposes milestones after their Shanghai due date", () => {
    expect(dueSampleMilestoneKeys(new Date("2026-07-11T12:30:00Z"))).toEqual([]);
    expect(dueSampleMilestoneKeys(new Date("2026-07-12T12:30:00Z"))).toEqual(["light_t2"]);
    expect(dueSampleMilestoneKeys(new Date("2026-07-16T12:30:00Z"))).toEqual(["light_t2", "t2"]);
    expect(dueSampleMilestoneKeys(new Date("2026-07-23T12:30:00Z"))).toEqual(["light_t2", "t2", "t3"]);
    expect(SAMPLE_RETEST_MILESTONES.map(item => item.roundType)).toEqual([null, "T2_RETEST", "T3_RETEST"]);
  });

  it("provides a daily schedule and safe manual dry-run", () => {
    const workflow = read(".github/workflows/scheduled-sample-retest.yml");
    expect(workflow).toContain('cron: "30 12 * * *"');
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("dry_run:");
    expect(workflow).toContain("ensure_questions:");
    expect(workflow).toContain("--dry-run");
    expect(workflow).toContain("--ensure-questions");
    expect(workflow).not.toContain("180001");
  });

  it("shows automatic status and failures on both customer pages", () => {
    const monitoring = read("client/src/pages/InclusionMonitoringCenterPage.tsx");
    const report = read("client/src/pages/DeliveryReportsCenterPage.tsx");
    for (const source of [monitoring, report]) {
      expect(source).toContain("自动复测");
      expect(source).toContain("scheduledRetestStatusLabel");
      expect(source).toContain("失败原因");
    }
  });
});
