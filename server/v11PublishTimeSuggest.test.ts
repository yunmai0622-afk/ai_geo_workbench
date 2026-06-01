import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Publish-Time-Suggest", () => {
  it("shows static publish time hint in enqueue confirmation dialog", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("getPublishTimeSuggest");
    expect(weekly).toContain("publish-time-suggest");
    expect(weekly).toContain("建议发布时间");
  });
});
