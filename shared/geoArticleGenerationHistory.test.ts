import { describe, expect, it } from "vitest";
import {
  applyGeoArticleGenerationHistoryRestore,
  buildGeoArticleGenerationHistory,
  findGeoArticleGenerationHistoryEntry,
} from "./geoArticleGenerationHistory";

describe("geoArticleGenerationHistory", () => {
  const article = {
    id: 10,
    topicId: 3,
    title: "当前标题",
    markdownContent: "当前正文",
    status: "质检通过",
    createdAt: "2026-06-01T08:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    optimizationVersions: [
      {
        version: 1,
        createdAt: "2026-06-01T09:00:00.000Z",
        mode: "GEO 质检自动重写",
        previousStatus: "待质检",
        title: "旧标题",
        markdownContent: "旧正文",
        reason: "质检未通过",
      },
    ],
  };

  it("merges current, prior generations and optimization snapshots", () => {
    const entries = buildGeoArticleGenerationHistory({
      article,
      priorGenerations: [
        {
          id: 8,
          title: "首次生成",
          markdownContent: "首次正文",
          status: "已生成",
          createdAt: "2026-06-01T07:00:00.000Z",
        },
      ],
    });
    expect(entries.map(e => e.key)).toEqual(["current", "opt:1", "gen:8"]);
    expect(entries.find(e => e.key === "gen:8")?.canRestore).toBe(true);
    expect(entries.find(e => e.key === "current")?.canRestore).toBe(false);
  });

  it("restores snapshot and keeps backup in optimizationVersions", () => {
    const entries = buildGeoArticleGenerationHistory({ article, priorGenerations: [] });
    const target = findGeoArticleGenerationHistoryEntry(entries, "opt:1");
    expect(target).toBeDefined();
    const restored = applyGeoArticleGenerationHistoryRestore({ article, entry: target! });
    expect(restored.title).toBe("旧标题");
    expect(restored.markdownContent).toBe("旧正文");
    expect(restored.optimizationVersions).toHaveLength(2);
    expect(restored.optimizationVersions[1]?.mode).toBe("历史版本恢复");
  });
});
