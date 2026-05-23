import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C5-D enterprise profile page product UI", () => {
  const page = read("client/src/pages/AssetCenter.tsx");

  it("uses five-block profile console layout", () => {
    expect(page).toContain("企业 AI 搜索档案");
    expect(page).toContain("ProfileIntakePanel");
    expect(page).toContain("上传企业资料");
    expect(page).toContain("档案完成进度");
    expect(page).toContain("品牌与产品信息");
    expect(page).toContain("目标客户与购买场景");
    expect(page).toContain("案例与信任素材");
    expect(page).toContain("完成企业档案，进入 AI 内容诊断");
    expect(page).toContain("AiPageShell");
    expect(page).not.toContain("Section 1 · 基本身份");
    expect(page).not.toContain("GeoStatusGuide");
  });

  it("keeps save handlers unchanged", () => {
    expect(page).toContain("upsertProfile.mutateAsync");
    expect(page).toContain("createCustomerCase.mutateAsync");
    expect(page).toContain("保存基本身份");
    expect(page).toContain("保存客户信息");
  });
});
