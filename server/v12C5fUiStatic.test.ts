import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C5-F sidebar label alignment", () => {
  it("shows 企业档案 in sidebar without changing route", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    const profile = read("client/src/pages/AssetCenter.tsx");
    expect(layout).toContain('label: "企业档案"');
    expect(layout).toContain("品牌与客户画像");
    expect(layout).toContain('path: "/enterprise-profile"');
    expect(layout).not.toContain('label: "我的信息"');
    expect(profile).toContain("企业 AI 搜索档案");
  });
});
