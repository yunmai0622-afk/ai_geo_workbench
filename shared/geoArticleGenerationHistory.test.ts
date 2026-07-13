import { describe, expect, it } from "vitest";
import {
  applyGeoArticleGenerationHistoryRestore,
  buildGeoArticleGenerationHistory,
  findGeoArticleGenerationHistoryEntry,
} from "./geoArticleGenerationHistory";
import { PLATFORM_DRAFT_PLACEHOLDER_MARKDOWN } from "./platformDraftGeneration";

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

  it("does not mark pending placeholder drafts as current body", () => {
    const entries = buildGeoArticleGenerationHistory({
      article: {
        ...article,
        title: "统一公司名称表达 · 延伸篇 2",
        markdownContent: PLATFORM_DRAFT_PLACEHOLDER_MARKDOWN,
        status: "待生成",
        optimizationVersions: [],
        generationBasis: {
          platformDraftGeneration: { status: "generating" },
        },
      },
      priorGenerations: [
        {
          id: 8,
          title: "历史待生成",
          markdownContent: PLATFORM_DRAFT_PLACEHOLDER_MARKDOWN,
          status: "待生成",
          createdAt: "2026-06-01T07:00:00.000Z",
        },
      ],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.key).toBe("current");
    expect(entries[0]?.sourceLabel).toBe("当前记录（未生成）");
    expect(entries[0]?.isCurrentBody).toBe(false);
    expect(entries[0]?.markdownContent).toBe("");
  });
});
