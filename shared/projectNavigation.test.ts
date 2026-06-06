import { describe, expect, it } from "vitest";
import { LEGACY_ORPHAN_PROJECT_ID } from "./const";
import {
  filterNavigableProjects,
  isLegacyOrphanProjectId,
  pickFirstNavigableProjectId,
} from "./projectNavigation";

describe("projectNavigation legacy orphan 30001", () => {
  it("filters orphan from navigable project list", () => {
    const rows = [
      { id: LEGACY_ORPHAN_PROJECT_ID, enterpriseName: "旧演示" },
      { id: 72, enterpriseName: "海豚知道" },
    ];
    expect(filterNavigableProjects(rows).map(r => r.id)).toEqual([72]);
  });

  it("pickFirstNavigableProjectId skips 30001 even when sorted first", () => {
    const id = pickFirstNavigableProjectId([
      { id: LEGACY_ORPHAN_PROJECT_ID },
      { id: 88 },
    ]);
    expect(id).toBe(88);
  });

  it("isLegacyOrphanProjectId", () => {
    expect(isLegacyOrphanProjectId(LEGACY_ORPHAN_PROJECT_ID)).toBe(true);
    expect(isLegacyOrphanProjectId(72)).toBe(false);
  });
});
