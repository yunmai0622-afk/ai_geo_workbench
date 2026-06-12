import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("weekly content page configurable generation (C4-A)", () => {
  const page = read("client/src/pages/WeeklyContentPage.tsx");
  const routers = read("server/routers.ts");

  it("still supports per-topic generation API", () => {
    expect(page).toContain("generateArticleMutation");
    expect(page).toMatch(/generationCount:\s*targetCount/);
    expect(read("client/src/components/weekly/PlatformContentBoard.tsx")).toContain("weekly-primary-");
  });

  it("router accepts generationCount with 1-50 bounds", () => {
    expect(routers).toContain("generationCount: z.number().int().min(1).max(50).optional()");
    expect(routers).toContain("targetCount: generationCount");
  });
});
